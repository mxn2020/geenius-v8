// src/lib/performance-metrics.ts

import { z } from 'zod'
import { logger } from './logging-system'
import { tokenTracker, type TokenUsage } from './token-tracking'

// Performance metric types
export const METRIC_TYPES = {
  // Execution metrics
  execution_time: 'execution_time',
  queue_time: 'queue_time',
  processing_time: 'processing_time',
  
  // Throughput metrics
  requests_per_second: 'requests_per_second',
  tokens_per_second: 'tokens_per_second',
  tasks_completed: 'tasks_completed',
  
  // Success/failure metrics
  success_rate: 'success_rate',
  error_rate: 'error_rate',
  retry_rate: 'retry_rate',
  
  // Resource utilization
  memory_usage: 'memory_usage',
  cpu_usage: 'cpu_usage',
  concurrent_executions: 'concurrent_executions',
  
  // Cost efficiency
  cost_per_request: 'cost_per_request',
  cost_per_token: 'cost_per_token',
  cost_per_successful_task: 'cost_per_successful_task',
  
  // Quality metrics
  output_quality_score: 'output_quality_score',
  user_satisfaction: 'user_satisfaction',
  task_complexity_score: 'task_complexity_score'
} as const

export type MetricType = keyof typeof METRIC_TYPES

// Performance metric entry schema
export const performanceMetricSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  
  // Context identification
  metricType: z.string(),
  agentId: z.string().optional(),
  executionId: z.string().optional(),
  projectId: z.string().optional(),
  userId: z.string().optional(),
  
  // Metric value
  value: z.number(),
  unit: z.string(),
  
  // Statistical data
  statistics: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    avg: z.number().optional(),
    median: z.number().optional(),
    p95: z.number().optional(),
    p99: z.number().optional(),
    stdDev: z.number().optional(),
    sampleCount: z.number().optional()
  }).optional(),
  
  // Dimensional data for grouping/filtering
  dimensions: z.record(z.string(), z.string()).default({}),
  
  // Metadata
  metadata: z.record(z.string(), z.any()).default({}),
  
  // Time window (for aggregate metrics)
  timeWindow: z.object({
    start: z.number(),
    end: z.number(),
    duration: z.number() // milliseconds
  }).optional()
})

export type PerformanceMetric = z.infer<typeof performanceMetricSchema>

// Execution performance data schema
export const executionPerformanceSchema = z.object({
  executionId: z.string(),
  agentId: z.string(),
  projectId: z.string(),
  
  // Timing metrics
  timing: z.object({
    startTime: z.number(),
    endTime: z.number(),
    duration: z.number(),
    queueTime: z.number().optional(),
    processingTime: z.number().optional(),
    phases: z.record(z.string(), z.object({
      start: z.number(),
      end: z.number(),
      duration: z.number()
    })).optional()
  }),
  
  // Resource utilization
  resources: z.object({
    peakMemoryUsage: z.number().optional(), // bytes
    avgMemoryUsage: z.number().optional(),  // bytes
    cpuTime: z.number().optional(),         // milliseconds
    diskIO: z.number().optional(),          // bytes
    networkIO: z.number().optional()        // bytes
  }),
  
  // Token and cost metrics
  tokenMetrics: z.object({
    totalTokens: z.number(),
    inputTokens: z.number(),
    outputTokens: z.number(),
    tokenEfficiency: z.number(), // tokens per second
    totalCost: z.number()
  }),
  
  // Quality metrics
  quality: z.object({
    successRate: z.number().min(0).max(1),
    outputQuality: z.number().min(0).max(1).optional(),
    userRating: z.number().min(1).max(5).optional(),
    taskComplexity: z.number().min(0).max(1).optional()
  }),
  
  // Error tracking
  errors: z.array(z.object({
    timestamp: z.number(),
    type: z.string(),
    message: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    recovered: z.boolean()
  })).default([]),
  
  // Comparison data
  benchmarks: z.object({
    historical_avg: z.number().optional(),
    peer_avg: z.number().optional(),
    target_sla: z.number().optional(),
    improvement_from_baseline: z.number().optional() // percentage
  }).optional()
})

export type ExecutionPerformance = z.infer<typeof executionPerformanceSchema>

// Performance monitoring configuration
export const performanceConfigSchema = z.object({
  enabled: z.boolean().default(true),
  
  // Collection settings
  collection: z.object({
    sampleRate: z.number().min(0).max(1).default(1.0), // 100% sampling by default
    bufferSize: z.number().default(1000),
    flushInterval: z.number().default(30000), // 30 seconds
    enableResourceMonitoring: z.boolean().default(true),
    enableQualityMetrics: z.boolean().default(true)
  }).default({
    sampleRate: 1.0,
    bufferSize: 1000,
    flushInterval: 30000,
    enableResourceMonitoring: true,
    enableQualityMetrics: true
  }),
  
  // Aggregation settings
  aggregation: z.object({
    enabled: z.boolean().default(true),
    intervals: z.array(z.enum(['minute', 'hour', 'day', 'week'])).default(['minute', 'hour', 'day']),
    retainRawData: z.boolean().default(true),
    retainRawDataHours: z.number().default(72) // 3 days
  }).default({
    enabled: true,
    intervals: ['minute', 'hour', 'day'],
    retainRawData: true,
    retainRawDataHours: 72
  }),
  
  // Performance targets/SLAs
  targets: z.object({
    maxExecutionTime: z.number().default(30000),    // 30 seconds
    maxQueueTime: z.number().default(5000),         // 5 seconds
    minSuccessRate: z.number().default(0.95),       // 95%
    maxErrorRate: z.number().default(0.05),         // 5%
    targetThroughput: z.number().default(10),       // requests per second
    maxCostPerRequest: z.number().default(0.10)     // $0.10
  }).default({
    maxExecutionTime: 30000,
    maxQueueTime: 5000,
    minSuccessRate: 0.95,
    maxErrorRate: 0.05,
    targetThroughput: 10,
    maxCostPerRequest: 0.10
  }),
  
  // Alerting
  alerting: z.object({
    enabled: z.boolean().default(true),
    thresholds: z.object({
      executionTimeP95: z.number().default(60000),  // 1 minute
      errorRateThreshold: z.number().default(0.10), // 10%
      memoryUsageThreshold: z.number().default(0.80), // 80%
      costSpikeThreshold: z.number().default(2.0)   // 200% increase
    }).default({
      executionTimeP95: 60000,
      errorRateThreshold: 0.10,
      memoryUsageThreshold: 0.80,
      costSpikeThreshold: 2.0
    })
  }).default({
    enabled: true,
    thresholds: {
      executionTimeP95: 60000,
      errorRateThreshold: 0.10,
      memoryUsageThreshold: 0.80,
      costSpikeThreshold: 2.0
    }
  })
})

export type PerformanceConfig = z.infer<typeof performanceConfigSchema>

// Performance metrics collector class
export class PerformanceMetricsCollector {
  private config: PerformanceConfig
  private metricsBuffer: PerformanceMetric[] = []
  private executionBuffer: ExecutionPerformance[] = []
  private activeExecutions = new Map<string, ExecutionContext>()
  private flushTimer: NodeJS.Timeout | null = null
  
  constructor(config: Partial<PerformanceConfig> = {}) {
    this.config = performanceConfigSchema.parse(config)
    
    if (this.config.enabled) {
      this.startFlushTimer()
    }
  }
  
  // Start tracking an execution
  startExecution(
    executionId: string,
    agentId: string,
    projectId: string,
    metadata: Record<string, any> = {}
  ): ExecutionTracker {
    
    if (!this.config.enabled || Math.random() > this.config.collection.sampleRate) {
      return new NoOpExecutionTracker()
    }
    
    const context: ExecutionContext = {
      executionId,
      agentId,
      projectId,
      startTime: Date.now(),
      metadata,
      phases: new Map(),
      errors: [],
      resources: {
        startMemory: this.getMemoryUsage()
      }
    }
    
    this.activeExecutions.set(executionId, context)
    
    logger.debug('Execution tracking started', {
      category: 'performance_metric',
      component: 'performance-collector',
      executionId,
      agentId,
      metadata
    })
    
    return new ExecutionTracker(this, executionId)
  }
  
  // Record a performance metric
  recordMetric(
    type: MetricType,
    value: number,
    unit: string,
    context: {
      agentId?: string
      executionId?: string
      projectId?: string
      dimensions?: Record<string, string>
      metadata?: Record<string, any>
    } = {}
  ): void {
    
    if (!this.config.enabled || Math.random() > this.config.collection.sampleRate) {
      return
    }
    
    const metric: PerformanceMetric = {
      id: this.generateId(),
      timestamp: Date.now(),
      metricType: type,
      value,
      unit,
      agentId: context.agentId,
      executionId: context.executionId,
      projectId: context.projectId,
      dimensions: context.dimensions || {},
      metadata: context.metadata || {}
    }
    
    this.metricsBuffer.push(metric)
    
    // Check for immediate flush if buffer is full
    if (this.metricsBuffer.length >= this.config.collection.bufferSize) {
      this.flush().catch(error => {
        logger.error('Failed to flush metrics buffer', error as Error, {
          component: 'performance-collector'
        })
      })
    }
  }
  
  // Complete an execution and record its performance
  completeExecution(
    executionId: string,
    success: boolean,
    tokenUsage?: TokenUsage,
    qualityMetrics?: {
      outputQuality?: number
      userRating?: number
      taskComplexity?: number
    }
  ): ExecutionPerformance | null {
    
    const context = this.activeExecutions.get(executionId)
    if (!context) {
      return null
    }
    
    const endTime = Date.now()
    const duration = endTime - context.startTime
    const endMemory = this.getMemoryUsage()
    
    // Create execution performance record
    const performance: ExecutionPerformance = {
      executionId,
      agentId: context.agentId,
      projectId: context.projectId,
      timing: {
        startTime: context.startTime,
        endTime,
        duration,
        queueTime: context.queueTime,
        processingTime: duration - (context.queueTime || 0),
        phases: Object.fromEntries(
          Array.from(context.phases.entries()).map(([name, phase]) => [
            name,
            {
              start: phase.start,
              end: phase.end || endTime,
              duration: (phase.end || endTime) - phase.start
            }
          ])
        )
      },
      resources: {
        peakMemoryUsage: context.resources.peakMemory || endMemory,
        avgMemoryUsage: context.resources.avgMemory,
        cpuTime: context.resources.cpuTime
      },
      tokenMetrics: tokenUsage ? {
        totalTokens: tokenUsage.tokens.total,
        inputTokens: tokenUsage.tokens.input,
        outputTokens: tokenUsage.tokens.output,
        tokenEfficiency: duration > 0 ? (tokenUsage.tokens.total / duration) * 1000 : 0,
        totalCost: tokenUsage.costs.total
      } : {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        tokenEfficiency: 0,
        totalCost: 0
      },
      quality: {
        successRate: success ? 1.0 : 0.0,
        outputQuality: qualityMetrics?.outputQuality,
        userRating: qualityMetrics?.userRating,
        taskComplexity: qualityMetrics?.taskComplexity
      },
      errors: context.errors
    }
    
    // Add benchmarking data
    performance.benchmarks = this.calculateBenchmarks(performance)
    
    this.executionBuffer.push(performance)
    this.activeExecutions.delete(executionId)
    
    // Record key metrics
    this.recordMetric('execution_time', duration, 'milliseconds', {
      agentId: context.agentId,
      executionId,
      projectId: context.projectId,
      dimensions: { success: success.toString() }
    })
    
    if (tokenUsage) {
      this.recordMetric('cost_per_request', tokenUsage.costs.total, 'USD', {
        agentId: context.agentId,
        executionId,
        projectId: context.projectId
      })
      
      this.recordMetric('tokens_per_second', performance.tokenMetrics.tokenEfficiency, 'tokens/second', {
        agentId: context.agentId,
        executionId,
        projectId: context.projectId
      })
    }
    
    // Check SLA compliance and alerting
    this.checkSLACompliance(performance)
    
    logger.info('Execution completed', {
      category: 'performance_metric',
      component: 'performance-collector',
      executionId,
      agentId: context.agentId,
      metadata: {
        duration,
        success,
        tokenCount: tokenUsage?.tokens.total || 0,
        cost: tokenUsage?.costs.total || 0
      },
      performance: {
        duration,
        tokenCount: tokenUsage?.tokens.total || 0,
        cost: tokenUsage?.costs.total || 0
      }
    })
    
    return performance
  }
  
  // Get performance statistics for an agent
  async getAgentStats(
    agentId: string,
    timeRange: number = 3600000 // 1 hour
  ): Promise<{
    avgExecutionTime: number
    successRate: number
    totalExecutions: number
    totalCost: number
    totalTokens: number
    errorRate: number
    p95ExecutionTime: number
  }> {
    
    const now = Date.now()
    const startTime = now - timeRange
    
    const executions = this.executionBuffer.filter(exec => 
      exec.agentId === agentId && exec.timing.startTime >= startTime
    )
    
    if (executions.length === 0) {
      return {
        avgExecutionTime: 0,
        successRate: 0,
        totalExecutions: 0,
        totalCost: 0,
        totalTokens: 0,
        errorRate: 0,
        p95ExecutionTime: 0
      }
    }
    
    const durations = executions.map(e => e.timing.duration).sort((a, b) => a - b)
    const successes = executions.filter(e => e.quality.successRate > 0).length
    const totalCost = executions.reduce((sum, e) => sum + e.tokenMetrics.totalCost, 0)
    const totalTokens = executions.reduce((sum, e) => sum + e.tokenMetrics.totalTokens, 0)
    const totalErrors = executions.reduce((sum, e) => sum + e.errors.length, 0)
    
    const p95Index = Math.floor(durations.length * 0.95)
    const p95ExecutionTime = durations[p95Index] || 0
    
    return {
      avgExecutionTime: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      successRate: successes / executions.length,
      totalExecutions: executions.length,
      totalCost,
      totalTokens,
      errorRate: totalErrors / executions.length,
      p95ExecutionTime
    }
  }
  
  // Get system-wide performance overview
  async getSystemOverview(timeRange: number = 3600000): Promise<{
    totalExecutions: number
    avgSuccessRate: number
    avgExecutionTime: number
    totalCost: number
    totalTokens: number
    topPerformingAgents: Array<{ agentId: string; successRate: number; avgTime: number }>
    slowestOperations: Array<{ executionId: string; duration: number; agentId: string }>
  }> {
    
    const now = Date.now()
    const startTime = now - timeRange
    
    const executions = this.executionBuffer.filter(exec => 
      exec.timing.startTime >= startTime
    )
    
    const totalExecutions = executions.length
    const avgSuccessRate = executions.reduce((sum, e) => sum + e.quality.successRate, 0) / totalExecutions
    const avgExecutionTime = executions.reduce((sum, e) => sum + e.timing.duration, 0) / totalExecutions
    const totalCost = executions.reduce((sum, e) => sum + e.tokenMetrics.totalCost, 0)
    const totalTokens = executions.reduce((sum, e) => sum + e.tokenMetrics.totalTokens, 0)
    
    // Agent performance aggregation
    const agentStats = new Map<string, { successSum: number, timeSum: number, count: number }>()
    
    executions.forEach(exec => {
      const stats = agentStats.get(exec.agentId) || { successSum: 0, timeSum: 0, count: 0 }
      stats.successSum += exec.quality.successRate
      stats.timeSum += exec.timing.duration
      stats.count += 1
      agentStats.set(exec.agentId, stats)
    })
    
    const topPerformingAgents = Array.from(agentStats.entries())
      .map(([agentId, stats]) => ({
        agentId,
        successRate: stats.successSum / stats.count,
        avgTime: stats.timeSum / stats.count
      }))
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 10)
    
    const slowestOperations = executions
      .sort((a, b) => b.timing.duration - a.timing.duration)
      .slice(0, 10)
      .map(exec => ({
        executionId: exec.executionId,
        duration: exec.timing.duration,
        agentId: exec.agentId
      }))
    
    return {
      totalExecutions,
      avgSuccessRate,
      avgExecutionTime,
      totalCost,
      totalTokens,
      topPerformingAgents,
      slowestOperations
    }
  }
  
  // Private helper methods
  private calculateBenchmarks(performance: ExecutionPerformance): ExecutionPerformance['benchmarks'] {
    // This would typically compare against historical data
    // For now, return basic comparison with targets
    return {
      target_sla: this.config.targets.maxExecutionTime,
      improvement_from_baseline: 0 // Would calculate from historical baseline
    }
  }
  
  private checkSLACompliance(performance: ExecutionPerformance): void {
    const violations = []
    
    if (performance.timing.duration > this.config.targets.maxExecutionTime) {
      violations.push(`Execution time exceeded target: ${performance.timing.duration}ms > ${this.config.targets.maxExecutionTime}ms`)
    }
    
    if (performance.quality.successRate < this.config.targets.minSuccessRate) {
      violations.push(`Success rate below target: ${performance.quality.successRate} < ${this.config.targets.minSuccessRate}`)
    }
    
    if (performance.tokenMetrics.totalCost > this.config.targets.maxCostPerRequest) {
      violations.push(`Cost per request exceeded: $${performance.tokenMetrics.totalCost} > $${this.config.targets.maxCostPerRequest}`)
    }
    
    if (violations.length > 0) {
      logger.warn('SLA violations detected', {
        category: 'monitoring_alert',
        component: 'performance-collector',
        executionId: performance.executionId,
        agentId: performance.agentId,
        metadata: {
          violations,
          performance: {
            duration: performance.timing.duration,
            successRate: performance.quality.successRate,
            cost: performance.tokenMetrics.totalCost
          }
        }
      })
    }
  }
  
  private getMemoryUsage(): number {
    // Node.js memory usage
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed
    }
    return 0
  }
  
  private async flush(): Promise<void> {
    if (this.metricsBuffer.length === 0 && this.executionBuffer.length === 0) {
      return
    }
    
    try {
      // Flush metrics to storage
      if (this.metricsBuffer.length > 0) {
        const metrics = this.metricsBuffer.splice(0, this.config.collection.bufferSize)
        await this.saveMetricsToDatabase(metrics)
      }
      
      // Flush execution data to storage
      if (this.executionBuffer.length > 0) {
        const executions = this.executionBuffer.splice(0, this.config.collection.bufferSize)
        await this.saveExecutionsToDatabase(executions)
      }
      
    } catch (error) {
      logger.error('Failed to flush performance data', error as Error, {
        component: 'performance-collector'
      })
    }
  }
  
  private async saveMetricsToDatabase(metrics: PerformanceMetric[]): Promise<void> {
    // TODO: Implement Convex database save
    logger.debug(`Saving ${metrics.length} performance metrics to database`)
  }
  
  private async saveExecutionsToDatabase(executions: ExecutionPerformance[]): Promise<void> {
    // TODO: Implement Convex database save  
    logger.debug(`Saving ${executions.length} execution records to database`)
  }
  
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        logger.error('Scheduled flush failed', error as Error, {
          component: 'performance-collector'
        })
      })
    }, this.config.collection.flushInterval)
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }
  
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    await this.flush()
  }
}

// Execution context for tracking active executions
interface ExecutionContext {
  executionId: string
  agentId: string
  projectId: string
  startTime: number
  queueTime?: number
  metadata: Record<string, any>
  phases: Map<string, { start: number; end?: number }>
  errors: Array<{
    timestamp: number
    type: string
    message: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    recovered: boolean
  }>
  resources: {
    startMemory?: number
    peakMemory?: number
    avgMemory?: number
    cpuTime?: number
  }
}

// Execution tracker for individual executions
export class ExecutionTracker {
  constructor(
    private collector: PerformanceMetricsCollector,
    private executionId: string
  ) {}
  
  recordPhase(phaseName: string): PhaseTracker {
    const context = (this.collector as any).activeExecutions.get(this.executionId)
    if (context) {
      const startTime = Date.now()
      context.phases.set(phaseName, { start: startTime })
      return new PhaseTracker(context, phaseName)
    }
    return new NoOpPhaseTracker()
  }
  
  recordError(error: Error, severity: 'low' | 'medium' | 'high' | 'critical' = 'medium', recovered = false): void {
    const context = (this.collector as any).activeExecutions.get(this.executionId)
    if (context) {
      context.errors.push({
        timestamp: Date.now(),
        type: error.name,
        message: error.message,
        severity,
        recovered
      })
    }
  }
  
  setQueueTime(queueTime: number): void {
    const context = (this.collector as any).activeExecutions.get(this.executionId)
    if (context) {
      context.queueTime = queueTime
    }
  }
  
  complete(success: boolean, tokenUsage?: TokenUsage, qualityMetrics?: {
    outputQuality?: number
    userRating?: number
    taskComplexity?: number
  }): ExecutionPerformance | null {
    return this.collector.completeExecution(this.executionId, success, tokenUsage, qualityMetrics)
  }
}

// Phase tracker for tracking execution phases
export class PhaseTracker {
  constructor(
    private context: ExecutionContext,
    private phaseName: string
  ) {}
  
  complete(): void {
    const phase = this.context.phases.get(this.phaseName)
    if (phase) {
      phase.end = Date.now()
    }
  }
}

// No-op implementations for when tracking is disabled
class NoOpExecutionTracker extends ExecutionTracker {
  constructor() {
    super(null as any, '')
  }
  
  recordPhase(): PhaseTracker {
    return new NoOpPhaseTracker()
  }
  
  recordError(): void {}
  setQueueTime(): void {}
  complete(): null {
    return null
  }
}

class NoOpPhaseTracker extends PhaseTracker {
  constructor() {
    super(null as any, '')
  }
  
  complete(): void {}
}

// Global performance collector instance
export const performanceCollector = new PerformanceMetricsCollector()

// Utility functions for common performance tracking patterns
export const trackExecution = (
  executionId: string,
  agentId: string,
  projectId: string,
  metadata?: Record<string, any>
): ExecutionTracker => {
  return performanceCollector.startExecution(executionId, agentId, projectId, metadata)
}

export const recordMetric = (
  type: MetricType,
  value: number,
  unit: string,
  context?: {
    agentId?: string
    executionId?: string
    projectId?: string
    dimensions?: Record<string, string>
  }
): void => {
  performanceCollector.recordMetric(type, value, unit, context)
}

export const withPerformanceTracking = <T extends (...args: any[]) => any>(
  fn: T,
  name: string,
  agentId?: string,
  executionId?: string
): T => {
  return ((...args: any[]) => {
    const startTime = Date.now()
    
    try {
      const result = fn(...args)
      
      if (result instanceof Promise) {
        return result
          .then(value => {
            const duration = Date.now() - startTime
            recordMetric('execution_time', duration, 'milliseconds', {
              agentId,
              executionId,
              dimensions: { operation: name, success: 'true' }
            })
            return value
          })
          .catch(error => {
            const duration = Date.now() - startTime
            recordMetric('execution_time', duration, 'milliseconds', {
              agentId,
              executionId,
              dimensions: { operation: name, success: 'false' }
            })
            throw error
          })
      }
      
      const duration = Date.now() - startTime
      recordMetric('execution_time', duration, 'milliseconds', {
        agentId,
        executionId,
        dimensions: { operation: name, success: 'true' }
      })
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      recordMetric('execution_time', duration, 'milliseconds', {
        agentId,
        executionId,
        dimensions: { operation: name, success: 'false' }
      })
      throw error
    }
  }) as T
}