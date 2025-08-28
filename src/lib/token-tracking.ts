// src/lib/token-tracking.ts

import { z } from 'zod'
import { logger } from './logging-system'
import { type EnhancedModelInfo, calculateEstimatedCost } from './model-config'

// Token usage categories
export const TOKEN_USAGE_TYPES = {
  input: 'input',
  output: 'output',
  cached_input: 'cached_input',
  cache_creation: 'cache_creation',
  reasoning: 'reasoning' // for models like o1 that have internal reasoning
} as const

export type TokenUsageType = keyof typeof TOKEN_USAGE_TYPES

// Token usage entry schema
export const tokenUsageSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  
  // Context identification
  agentId: z.string(),
  executionId: z.string(),
  projectId: z.string(),
  userId: z.string().optional(),
  
  // Model information
  modelId: z.string(),
  modelProvider: z.string(),
  
  // Token counts by type
  tokens: z.object({
    input: z.number().default(0),
    output: z.number().default(0),
    cached_input: z.number().default(0),
    cache_creation: z.number().default(0),
    reasoning: z.number().default(0),
    total: z.number()
  }),
  
  // Cost information
  costs: z.object({
    input: z.number().default(0),
    output: z.number().default(0),
    cached_input: z.number().default(0),
    cache_creation: z.number().default(0),
    reasoning: z.number().default(0),
    total: z.number()
  }),
  
  // Request details
  request: z.object({
    endpoint: z.string().optional(),
    method: z.string().optional(),
    requestId: z.string().optional(),
    parentRequestId: z.string().optional()
  }).optional(),
  
  // Performance metrics
  performance: z.object({
    latency: z.number().optional(), // milliseconds
    throughput: z.number().optional(), // tokens per second
    retryCount: z.number().default(0),
    cacheHitRate: z.number().optional() // 0-1
  }).default({
    retryCount: 0
  }),
  
  // Metadata
  metadata: z.record(z.string(), z.any()).default({}),
  
  // Error information if the request failed
  error: z.object({
    code: z.string(),
    message: z.string(),
    retryable: z.boolean()
  }).optional()
})

export type TokenUsage = z.infer<typeof tokenUsageSchema>

// Aggregated usage statistics
export const usageStatsSchema = z.object({
  period: z.enum(['hour', 'day', 'week', 'month']),
  startTime: z.number(),
  endTime: z.number(),
  
  // Aggregation context
  agentId: z.string().optional(),
  executionId: z.string().optional(),
  projectId: z.string().optional(),
  modelId: z.string().optional(),
  
  // Aggregated metrics
  totalTokens: z.number(),
  totalCost: z.number(),
  requestCount: z.number(),
  
  // Token breakdown
  tokenBreakdown: z.object({
    input: z.number(),
    output: z.number(),
    cached_input: z.number(),
    cache_creation: z.number(),
    reasoning: z.number()
  }),
  
  // Cost breakdown  
  costBreakdown: z.object({
    input: z.number(),
    output: z.number(),
    cached_input: z.number(),
    cache_creation: z.number(),
    reasoning: z.number()
  }),
  
  // Performance aggregates
  avgLatency: z.number(),
  avgThroughput: z.number(),
  errorRate: z.number(), // 0-1
  cacheHitRate: z.number(), // 0-1
  
  // Model distribution
  modelUsage: z.record(z.string(), z.object({
    tokens: z.number(),
    cost: z.number(),
    requests: z.number()
  }))
})

export type UsageStats = z.infer<typeof usageStatsSchema>

// Token tracker configuration
export const tokenTrackerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  
  // Storage configuration
  storage: z.object({
    enableDatabase: z.boolean().default(true),
    enableMemoryBuffer: z.boolean().default(true),
    bufferSize: z.number().default(1000),
    flushInterval: z.number().default(10000), // 10 seconds
    retentionDays: z.number().default(365)
  }).default({
    enableDatabase: true,
    enableMemoryBuffer: true,
    bufferSize: 1000,
    flushInterval: 10000,
    retentionDays: 365
  }),
  
  // Cost tracking
  costTracking: z.object({
    enabled: z.boolean().default(true),
    currency: z.string().default('USD'),
    refreshPricing: z.boolean().default(true),
    pricingCacheMinutes: z.number().default(60)
  }).default({
    enabled: true,
    currency: 'USD',
    refreshPricing: true,
    pricingCacheMinutes: 60
  }),
  
  // Alerting thresholds
  alerts: z.object({
    enabled: z.boolean().default(true),
    costThresholds: z.object({
      hourly: z.number().default(10), // $10/hour
      daily: z.number().default(100), // $100/day
      monthly: z.number().default(1000) // $1000/month
    }).default({
      hourly: 10,
      daily: 100,
      monthly: 1000
    }),
    tokenThresholds: z.object({
      hourly: z.number().default(100000), // 100k tokens/hour
      daily: z.number().default(1000000), // 1M tokens/day
      monthly: z.number().default(10000000) // 10M tokens/month
    }).default({
      hourly: 100000,
      daily: 1000000,
      monthly: 10000000
    })
  }).default({
    enabled: true,
    costThresholds: {
      hourly: 10,
      daily: 100,
      monthly: 1000
    },
    tokenThresholds: {
      hourly: 100000,
      daily: 1000000,
      monthly: 10000000
    }
  }),
  
  // Aggregation settings
  aggregation: z.object({
    enabled: z.boolean().default(true),
    intervals: z.array(z.enum(['hour', 'day', 'week', 'month'])).default(['hour', 'day', 'month']),
    retainRawData: z.boolean().default(true),
    retainRawDataDays: z.number().default(30)
  }).default({
    enabled: true,
    intervals: ['hour', 'day', 'month'],
    retainRawData: true,
    retainRawDataDays: 30
  })
})

export type TokenTrackerConfig = z.infer<typeof tokenTrackerConfigSchema>

// Token usage tracker class
export class TokenUsageTracker {
  private config: TokenTrackerConfig
  private buffer: TokenUsage[] = []
  private flushTimer: NodeJS.Timeout | null = null
  
  constructor(config: Partial<TokenTrackerConfig> = {}) {
    this.config = tokenTrackerConfigSchema.parse(config)
    
    if (this.config.storage.enableMemoryBuffer) {
      this.startFlushTimer()
    }
  }
  
  // Track token usage for a model request
  async trackUsage(
    agentId: string,
    executionId: string,
    modelInfo: EnhancedModelInfo,
    tokenCounts: Partial<TokenUsage['tokens']>,
    options: {
      projectId: string
      userId?: string
      requestId?: string
      parentRequestId?: string
      performance?: Partial<TokenUsage['performance']>
      metadata?: Record<string, any>
      error?: Partial<TokenUsage['error']>
    }
  ): Promise<TokenUsage> {
    
    if (!this.config.enabled) {
      return this.createEmptyUsage(agentId, executionId, modelInfo.id)
    }
    
    // Calculate total tokens
    const tokens = {
      input: tokenCounts.input || 0,
      output: tokenCounts.output || 0,
      cached_input: tokenCounts.cached_input || 0,
      cache_creation: tokenCounts.cache_creation || 0,
      reasoning: tokenCounts.reasoning || 0,
      total: 0
    }
    
    tokens.total = tokens.input + tokens.output + tokens.cached_input + 
                   tokens.cache_creation + tokens.reasoning
    
    // Calculate costs
    const costs = this.calculateCosts(tokens, modelInfo)
    
    // Create usage entry
    const usage: TokenUsage = {
      id: this.generateId(),
      timestamp: Date.now(),
      agentId,
      executionId,
      projectId: options.projectId,
      userId: options.userId,
      modelId: modelInfo.id,
      modelProvider: modelInfo.provider,
      tokens,
      costs,
      request: {
        requestId: options.requestId,
        parentRequestId: options.parentRequestId
      },
      performance: {
        retryCount: 0,
        ...options.performance
      },
      metadata: options.metadata || {},
      error: options.error && options.error.code ? options.error as TokenUsage['error'] : undefined
    }
    
    // Store the usage
    await this.store(usage)
    
    // Check for alerts
    await this.checkAlerts(usage)
    
    // Log the usage
    logger.info('Token usage tracked', {
      category: 'model_inference',
      component: 'token-tracker',
      agentId,
      executionId,
      metadata: {
        modelId: modelInfo.id,
        totalTokens: tokens.total,
        totalCost: costs.total,
        provider: modelInfo.provider
      },
      performance: {
        tokenCount: tokens.total,
        cost: costs.total
      }
    })
    
    return usage
  }
  
  // Get usage statistics for a specific context
  async getUsageStats(
    period: UsageStats['period'],
    startTime: number,
    endTime: number,
    filters: {
      agentId?: string
      executionId?: string
      projectId?: string
      modelId?: string
    } = {}
  ): Promise<UsageStats> {
    
    // In a real implementation, this would query the database
    // For now, we'll return a mock response
    return {
      period,
      startTime,
      endTime,
      ...filters,
      totalTokens: 0,
      totalCost: 0,
      requestCount: 0,
      tokenBreakdown: {
        input: 0,
        output: 0,
        cached_input: 0,
        cache_creation: 0,
        reasoning: 0
      },
      costBreakdown: {
        input: 0,
        output: 0,
        cached_input: 0,
        cache_creation: 0,
        reasoning: 0
      },
      avgLatency: 0,
      avgThroughput: 0,
      errorRate: 0,
      cacheHitRate: 0,
      modelUsage: {}
    }
  }
  
  // Get recent usage for an agent
  async getAgentUsage(
    agentId: string, 
    timeRange: number = 3600000 // 1 hour default
  ): Promise<TokenUsage[]> {
    const now = Date.now()
    const startTime = now - timeRange
    
    // In a real implementation, this would query the database
    // For now, return filtered buffer
    return this.buffer.filter(usage => 
      usage.agentId === agentId && 
      usage.timestamp >= startTime
    )
  }
  
  // Get cost summary for a project
  async getProjectCostSummary(
    projectId: string,
    timeRange: number = 86400000 // 24 hours default
  ): Promise<{
    totalCost: number
    costByAgent: Record<string, number>
    costByModel: Record<string, number>
    tokenCount: number
    requestCount: number
  }> {
    const now = Date.now()
    const startTime = now - timeRange
    
    const projectUsage = this.buffer.filter(usage => 
      usage.projectId === projectId && 
      usage.timestamp >= startTime
    )
    
    const summary = {
      totalCost: 0,
      costByAgent: {} as Record<string, number>,
      costByModel: {} as Record<string, number>,
      tokenCount: 0,
      requestCount: projectUsage.length
    }
    
    for (const usage of projectUsage) {
      summary.totalCost += usage.costs.total
      summary.tokenCount += usage.tokens.total
      
      // Aggregate by agent
      if (!summary.costByAgent[usage.agentId]) {
        summary.costByAgent[usage.agentId] = 0
      }
      summary.costByAgent[usage.agentId] += usage.costs.total
      
      // Aggregate by model
      if (!summary.costByModel[usage.modelId]) {
        summary.costByModel[usage.modelId] = 0
      }
      summary.costByModel[usage.modelId] += usage.costs.total
    }
    
    return summary
  }
  
  // Export usage data
  async exportUsage(
    filters: {
      startTime?: number
      endTime?: number
      agentId?: string
      projectId?: string
      format?: 'json' | 'csv'
    } = {}
  ): Promise<string> {
    const now = Date.now()
    const startTime = filters.startTime || (now - 86400000) // 24 hours default
    const endTime = filters.endTime || now
    
    let usage = this.buffer.filter(entry => 
      entry.timestamp >= startTime && entry.timestamp <= endTime
    )
    
    if (filters.agentId) {
      usage = usage.filter(entry => entry.agentId === filters.agentId)
    }
    
    if (filters.projectId) {
      usage = usage.filter(entry => entry.projectId === filters.projectId)
    }
    
    if (filters.format === 'csv') {
      return this.formatAsCSV(usage)
    }
    
    return JSON.stringify(usage, null, 2)
  }
  
  // Private helper methods
  private calculateCosts(tokens: TokenUsage['tokens'], model: EnhancedModelInfo): TokenUsage['costs'] {
    if (!this.config.costTracking.enabled) {
      return {
        input: 0,
        output: 0,
        cached_input: 0,
        cache_creation: 0,
        reasoning: 0,
        total: 0
      }
    }
    
    const inputCost = (tokens.input / 1000) * model.costPer1kTokens.input
    const outputCost = (tokens.output / 1000) * model.costPer1kTokens.output
    
    // For cached and reasoning tokens, use input pricing as default
    // In a real implementation, you'd have specific pricing for these
    const cachedInputCost = (tokens.cached_input / 1000) * (model.costPer1kTokens.input * 0.5) // 50% discount assumption
    const cacheCreationCost = (tokens.cache_creation / 1000) * model.costPer1kTokens.input
    const reasoningCost = (tokens.reasoning / 1000) * model.costPer1kTokens.input // Same as input
    
    const total = inputCost + outputCost + cachedInputCost + cacheCreationCost + reasoningCost
    
    return {
      input: inputCost,
      output: outputCost,
      cached_input: cachedInputCost,
      cache_creation: cacheCreationCost,
      reasoning: reasoningCost,
      total
    }
  }
  
  private async store(usage: TokenUsage): Promise<void> {
    if (this.config.storage.enableMemoryBuffer) {
      this.buffer.push(usage)
      
      if (this.buffer.length >= this.config.storage.bufferSize) {
        await this.flush()
      }
    }
    
    if (this.config.storage.enableDatabase) {
      // In a real implementation, this would save to Convex
      await this.saveToDatabase(usage)
    }
  }
  
  private async saveToDatabase(usage: TokenUsage): Promise<void> {
    // TODO: Implement Convex mutation
    // await ctx.db.insert("tokenUsage", usage)
  }
  
  private async flush(): Promise<void> {
    if (!this.config.storage.enableDatabase || this.buffer.length === 0) {
      return
    }
    
    const batch = this.buffer.splice(0, this.config.storage.bufferSize)
    
    try {
      for (const usage of batch) {
        await this.saveToDatabase(usage)
      }
    } catch (error) {
      // On error, put entries back in buffer
      this.buffer.unshift(...batch)
      logger.error('Failed to flush token usage to database', error as Error, {
        component: 'token-tracker',
        metadata: { batchSize: batch.length }
      })
    }
  }
  
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        logger.error('Scheduled flush failed', error as Error, {
          component: 'token-tracker'
        })
      })
    }, this.config.storage.flushInterval)
  }
  
  private async checkAlerts(usage: TokenUsage): Promise<void> {
    if (!this.config.alerts.enabled) return
    
    // Check hourly thresholds
    const hourlyUsage = await this.getUsageInTimeRange(3600000) // 1 hour
    const hourlyCost = hourlyUsage.reduce((sum, u) => sum + u.costs.total, 0)
    const hourlyTokens = hourlyUsage.reduce((sum, u) => sum + u.tokens.total, 0)
    
    if (hourlyCost > this.config.alerts.costThresholds.hourly) {
      logger.warn(`Hourly cost threshold exceeded: $${hourlyCost.toFixed(2)}`, {
        category: 'monitoring_alert',
        component: 'token-tracker',
        metadata: {
          threshold: this.config.alerts.costThresholds.hourly,
          actual: hourlyCost,
          period: 'hourly'
        }
      })
    }
    
    if (hourlyTokens > this.config.alerts.tokenThresholds.hourly) {
      logger.warn(`Hourly token threshold exceeded: ${hourlyTokens} tokens`, {
        category: 'monitoring_alert',
        component: 'token-tracker',
        metadata: {
          threshold: this.config.alerts.tokenThresholds.hourly,
          actual: hourlyTokens,
          period: 'hourly'
        }
      })
    }
  }
  
  private async getUsageInTimeRange(timeRange: number): Promise<TokenUsage[]> {
    const now = Date.now()
    const startTime = now - timeRange
    
    return this.buffer.filter(usage => usage.timestamp >= startTime)
  }
  
  private formatAsCSV(usage: TokenUsage[]): string {
    if (usage.length === 0) return 'No data'
    
    const headers = [
      'timestamp', 'agentId', 'executionId', 'modelId', 'modelProvider',
      'inputTokens', 'outputTokens', 'totalTokens', 'totalCost'
    ]
    
    const rows = usage.map(entry => [
      new Date(entry.timestamp).toISOString(),
      entry.agentId,
      entry.executionId,
      entry.modelId,
      entry.modelProvider,
      entry.tokens.input,
      entry.tokens.output,
      entry.tokens.total,
      entry.costs.total.toFixed(4)
    ])
    
    return [headers, ...rows].map(row => row.join(',')).join('\n')
  }
  
  private createEmptyUsage(agentId: string, executionId: string, modelId: string): TokenUsage {
    return {
      id: this.generateId(),
      timestamp: Date.now(),
      agentId,
      executionId,
      projectId: '',
      modelId,
      modelProvider: '',
      tokens: {
        input: 0,
        output: 0,
        cached_input: 0,
        cache_creation: 0,
        reasoning: 0,
        total: 0
      },
      costs: {
        input: 0,
        output: 0,
        cached_input: 0,
        cache_creation: 0,
        reasoning: 0,
        total: 0
      },
      performance: {
        retryCount: 0
      },
      metadata: {}
    }
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }
  
  // Cleanup
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    await this.flush()
  }
}

// Global token tracker instance
export const tokenTracker = new TokenUsageTracker()

// Utility functions for common usage patterns
export const trackModelRequest = async (
  agentId: string,
  executionId: string,
  modelInfo: EnhancedModelInfo,
  inputTokens: number,
  outputTokens: number,
  options: {
    projectId: string
    userId?: string
    requestId?: string
    latency?: number
    cacheHitRate?: number
    metadata?: Record<string, any>
  }
): Promise<TokenUsage> => {
  return tokenTracker.trackUsage(
    agentId,
    executionId,
    modelInfo,
    {
      input: inputTokens,
      output: outputTokens
    },
    {
      ...options,
      performance: {
        latency: options.latency,
        cacheHitRate: options.cacheHitRate,
        throughput: options.latency ? (inputTokens + outputTokens) / (options.latency / 1000) : undefined
      }
    }
  )
}

export const getAgentCostSummary = async (
  agentId: string,
  timeRangeHours: number = 24
): Promise<{ totalCost: number; totalTokens: number; requestCount: number }> => {
  const usage = await tokenTracker.getAgentUsage(agentId, timeRangeHours * 3600000)
  
  return {
    totalCost: usage.reduce((sum, u) => sum + u.costs.total, 0),
    totalTokens: usage.reduce((sum, u) => sum + u.tokens.total, 0),
    requestCount: usage.length
  }
}

export const createUsageReport = async (
  projectId: string,
  days: number = 7
): Promise<{
  summary: {
    totalCost: number
    totalTokens: number
    requestCount: number
    avgCostPerRequest: number
    topModels: Array<{ modelId: string; cost: number; requests: number }>
    topAgents: Array<{ agentId: string; cost: number; requests: number }>
  }
  dailyBreakdown: Array<{
    date: string
    cost: number
    tokens: number
    requests: number
  }>
}> => {
  const timeRange = days * 24 * 60 * 60 * 1000
  const summary = await tokenTracker.getProjectCostSummary(projectId, timeRange)
  
  const topModels = Object.entries(summary.costByModel)
    .map(([modelId, cost]) => ({ modelId, cost, requests: 0 }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5)
  
  const topAgents = Object.entries(summary.costByAgent)
    .map(([agentId, cost]) => ({ agentId, cost, requests: 0 }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 5)
  
  return {
    summary: {
      totalCost: summary.totalCost,
      totalTokens: summary.tokenCount,
      requestCount: summary.requestCount,
      avgCostPerRequest: summary.requestCount > 0 ? summary.totalCost / summary.requestCount : 0,
      topModels,
      topAgents
    },
    dailyBreakdown: [] // TODO: Implement daily breakdown
  }
}