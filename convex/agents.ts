// convex/agents.ts - Clean agent management API
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id, Doc } from './_generated/dataModel'
import {
  ensureEntityExists,
  ensureProjectAccess,
  ensureAgentAccess,
  validatePagination,
  BusinessLogicError,
  ValidationError,
  PaginatedResponse,
  CACHE_TTL,
  withCache
} from './utils/base'
import { 
  paginationArgs,
  filterArgs,
  statusSchemas,
  roleSchema,
  workflowPatternSchema,
  modelConfigSchema,
  memoryConfigSchema
} from './utils/schemas'

// Create a new agent
export const create = mutation({
  args: {
    projectId: v.id('projects'),
    authUserId: v.optional(v.string()),
    name: v.string(),
    description: v.optional(v.string()),
    role: roleSchema,
    protocol: v.string(),
    workflowPattern: workflowPatternSchema,
    modelConfig: modelConfigSchema,
    memoryConfig: memoryConfigSchema,
    capabilities: v.array(v.string()),
    metadata: v.optional(v.record(v.string(), v.any()))
  },
  handler: async (ctx, args) => {
    const { authUserId, ...agentData } = args
    
    // Verify project access
    await ensureProjectAccess(ctx, args.projectId, authUserId)
    
    const now = Date.now()
    
    const agentId = await ctx.db.insert('agents', {
      ...agentData,
      status: 'created',
      performance: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0,
        totalTokensUsed: 0,
        totalCostIncurred: 0,
        memoryPeak: 0,
        executionTime: 0,
        recentSuccessRate: 0,
        recentAvgExecutionTime: 0
      },
      lastActiveAt: now,
      createdBy: authUserId || 'system',
      createdAt: now,
      updatedAt: now,
      metadata: agentData.metadata || {}
    })
    
    return agentId
  }
})

// Get all agents with filtering and pagination
export const list = query({
  args: {
    projectId: v.optional(v.id('projects')),
    authUserId: v.optional(v.string()),
    ...paginationArgs,
    filters: v.optional(v.object({
      ...filterArgs,
      status: v.optional(statusSchemas.agent),
      role: v.optional(roleSchema),
      workflowPattern: v.optional(workflowPatternSchema)
    }))
  },
  handler: async (ctx, args): Promise<PaginatedResponse<Doc<'agents'>>> => {
    const { limit, offset } = validatePagination(args)
    
    let results: Doc<'agents'>[]
    
    // Apply project filter with proper query initialization
    if (args.projectId) {
      await ensureProjectAccess(ctx, args.projectId, args.authUserId)
      results = await ctx.db
        .query('agents')
        .withIndex('by_project', q => q.eq('projectId', args.projectId!))
        .order('desc')
        .collect()
    } else if (args.authUserId) {
      // Show only user's agents if no specific project
      results = await ctx.db
        .query('agents')
        .filter(q => q.eq(q.field('createdBy'), args.authUserId!))
        .order('desc')
        .collect()
    } else {
      // Get all agents (admin view)
      results = await ctx.db
        .query('agents')
        .order('desc')
        .collect()
    }
    
    // Apply additional filters in memory
    if (args.filters) {
      results = results.filter(agent => {
        if (args.filters!.status && agent.status !== args.filters!.status) return false
        if (args.filters!.role && agent.role !== args.filters!.role) return false
        if (args.filters!.workflowPattern && agent.workflowPattern !== args.filters!.workflowPattern) return false
        return true
      })
    }
    
    return {
      data: results.slice(offset, offset + limit),
      hasMore: results.length > offset + limit,
      total: results.length
    }
  }
})

// Get agent by ID
export const getById = query({
  args: { 
    id: v.id('agents'),
    authUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { agent } = await ensureAgentAccess(ctx, args.id, args.authUserId)
    return agent
  }
})

// Update agent configuration
export const update = mutation({
  args: {
    id: v.id('agents'),
    authUserId: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(statusSchemas.agent),
    protocol: v.optional(v.string()),
    workflowPattern: v.optional(workflowPatternSchema),
    modelConfig: v.optional(modelConfigSchema),
    memoryConfig: v.optional(memoryConfigSchema),
    capabilities: v.optional(v.array(v.string())),
    metadata: v.optional(v.record(v.string(), v.any()))
  },
  handler: async (ctx, args) => {
    const { id, authUserId, ...updates } = args
    const { agent } = await ensureAgentAccess(ctx, id, authUserId)
    
    const updateData: any = { updatedAt: Date.now() }
    
    // Handle simple field updates
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.protocol !== undefined) updateData.protocol = updates.protocol
    if (updates.workflowPattern !== undefined) updateData.workflowPattern = updates.workflowPattern
    if (updates.capabilities !== undefined) updateData.capabilities = updates.capabilities
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata
    
    // Handle nested object updates with proper merging
    if (updates.modelConfig) {
      updateData.modelConfig = {
        ...agent.modelConfig,
        ...updates.modelConfig,
        parameters: {
          ...agent.modelConfig.parameters,
          ...updates.modelConfig.parameters
        },
        rateLimiting: {
          ...agent.modelConfig.rateLimiting,
          ...updates.modelConfig.rateLimiting
        }
      }
    }
    
    if (updates.memoryConfig) {
      updateData.memoryConfig = {
        ...agent.memoryConfig,
        ...updates.memoryConfig,
        memoryTypes: {
          ...agent.memoryConfig.memoryTypes,
          ...updates.memoryConfig.memoryTypes
        }
      }
    }
    
    await ctx.db.patch(id, updateData)
    return id
  }
})

// Delete agent
export const remove = mutation({
  args: { 
    id: v.id('agents'),
    authUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { agent } = await ensureAgentAccess(ctx, args.id, args.authUserId)
    
    // Check if agent is currently active
    if (agent.status === 'active') {
      throw new BusinessLogicError('Cannot delete active agent')
    }
    
    // Check for running executions
    const runningExecutions = await ctx.db
      .query('executions')
      .withIndex('by_agent', q => q.eq('agentId', args.id))
      .filter(q => q.eq(q.field('status'), 'running'))
      .collect()
    
    if (runningExecutions.length > 0) {
      throw new BusinessLogicError('Cannot delete agent with running executions')
    }
    
    await ctx.db.delete(args.id)
    return true
  }
})

// Get agent performance metrics with caching
export const getPerformanceMetrics = query({
  args: {
    id: v.id('agents'),
    authUserId: v.optional(v.string()),
    timeRange: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { agent } = await ensureAgentAccess(ctx, args.id, args.authUserId)
    
    const cacheKey = `agent_metrics:${args.id}:${args.timeRange || 'all'}`
    
    return await withCache(cacheKey, CACHE_TTL.SHORT, async () => {
      const timeThreshold = args.timeRange ? Date.now() - args.timeRange : 0
      
      // Get all related data in parallel
      const [executions, performanceMetrics, tokenUsage] = await Promise.all([
        ctx.db
          .query('executions')
          .withIndex('by_agent', q => q.eq('agentId', args.id))
          .filter(q => q.gte(q.field('createdAt'), timeThreshold))
          .collect(),
        ctx.db
          .query('performanceMetrics')
          .withIndex('by_entity', q => 
            q.eq('entityType', 'agent').eq('entityId', args.id)
          )
          .filter(q => q.gte(q.field('timestamp'), timeThreshold))
          .collect(),
        ctx.db
          .query('tokenUsage')
          .withIndex('by_agent', q => q.eq('agentId', args.id))
          .filter(q => q.gte(q.field('timestamp'), timeThreshold))
          .collect()
      ])
      
      // Calculate metrics
      const totalExecutions = executions.length
      const successfulExecutions = executions.filter(e => e.status === 'completed').length
      const failedExecutions = executions.filter(e => e.status === 'failed').length
      const avgExecutionTime = executions.length > 0
        ? executions
            .filter(e => e.completedAt && e.startedAt)
            .reduce((sum, e) => sum + (e.completedAt! - e.startedAt!), 0) / executions.length
        : 0
      
      const totalTokensUsed = tokenUsage.reduce((sum, usage) => sum + usage.totalTokens, 0)
      const totalCostIncurred = tokenUsage.reduce((sum, usage) => sum + (usage.cost || 0), 0)
      
      const avgLatency = performanceMetrics
        .filter(m => m.metricType === 'execution_time')
        .reduce((sum, m, _, arr) => sum + m.value / arr.length, 0)
      
      return {
        agentId: args.id,
        timeRange: args.timeRange,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
        avgExecutionTime,
        totalTokensUsed,
        totalCostIncurred,
        costPerExecution: totalExecutions > 0 ? totalCostIncurred / totalExecutions : 0,
        tokensPerExecution: totalExecutions > 0 ? totalTokensUsed / totalExecutions : 0,
        avgLatency,
        performanceScore: calculatePerformanceScore(agent, {
          successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
          avgExecutionTime,
          avgLatency
        })
      }
    })
  }
})

// Update agent performance (internal use)
export const updatePerformance = mutation({
  args: {
    id: v.id('agents'),
    executionDelta: v.optional(v.object({
      total: v.number(),
      successful: v.number(),
      failed: v.number(),
      executionTime: v.number()
    })),
    resourceDelta: v.optional(v.object({
      tokens: v.number(),
      cost: v.number()
    }))
  },
  handler: async (ctx, args) => {
    const agent = await ensureEntityExists(ctx, 'agents', args.id, 'Agent')
    
    const updates: any = {
      updatedAt: Date.now(),
      lastActiveAt: Date.now()
    }
    
    if (args.executionDelta || args.resourceDelta) {
      const currentPerf = agent.performance || {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0,
        totalTokensUsed: 0,
        totalCostIncurred: 0,
        memoryPeak: 0,
        executionTime: 0,
        recentSuccessRate: 0,
        recentAvgExecutionTime: 0
      }
      
      updates.performance = { ...currentPerf }
      
      if (args.executionDelta) {
        const newTotal = currentPerf.totalExecutions + args.executionDelta.total
        updates.performance.totalExecutions = newTotal
        updates.performance.successfulExecutions += args.executionDelta.successful
        updates.performance.failedExecutions += args.executionDelta.failed
        
        // Recalculate average execution time
        if (newTotal > 0) {
          const currentTotalTime = currentPerf.avgExecutionTime * currentPerf.totalExecutions
          const newTotalTime = currentTotalTime + args.executionDelta.executionTime
          updates.performance.avgExecutionTime = newTotalTime / newTotal
        }
      }
      
      if (args.resourceDelta) {
        updates.performance.totalTokensUsed += args.resourceDelta.tokens
        updates.performance.totalCostIncurred += args.resourceDelta.cost
      }
    }
    
    await ctx.db.patch(args.id, updates)
    return args.id
  }
})

// Activate agent
export const activate = mutation({
  args: { 
    id: v.id('agents'),
    authUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { agent } = await ensureAgentAccess(ctx, args.id, args.authUserId)
    
    if (!['ready', 'paused'].includes(agent.status)) {
      throw new BusinessLogicError('Agent must be in ready or paused status to activate')
    }
    
    await ctx.db.patch(args.id, {
      status: 'active',
      updatedAt: Date.now(),
      lastActiveAt: Date.now()
    })
    
    return args.id
  }
})

// Deactivate agent
export const deactivate = mutation({
  args: { 
    id: v.id('agents'),
    authUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { agent } = await ensureAgentAccess(ctx, args.id, args.authUserId)
    
    if (agent.status !== 'active') {
      throw new BusinessLogicError('Agent must be active to deactivate')
    }
    
    await ctx.db.patch(args.id, {
      status: 'paused',
      updatedAt: Date.now()
    })
    
    return args.id
  }
})

// Validate agent configuration
export const validate = mutation({
  args: { 
    id: v.id('agents'),
    authUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { agent } = await ensureAgentAccess(ctx, args.id, args.authUserId)
    
    const issues = []
    
    // Validate model configuration
    if (!agent.modelConfig?.modelType) {
      issues.push('Model type is required')
    }
    
    if (!agent.modelConfig?.parameters?.maxTokens || agent.modelConfig.parameters.maxTokens <= 0) {
      issues.push('Max tokens must be positive')
    }
    
    if (agent.modelConfig?.parameters?.temperature !== undefined) {
      if (agent.modelConfig.parameters.temperature < 0 || agent.modelConfig.parameters.temperature > 1) {
        issues.push('Temperature must be between 0 and 1')
      }
    }
    
    // Validate memory configuration
    const totalMemorySize = Object.values(agent.memoryConfig?.memoryTypes || {})
      .reduce((sum, type: any) => sum + (type.enabled ? type.maxSize : 0), 0)
    
    if (totalMemorySize > (agent.memoryConfig?.contextWindow || 4000) * 0.8) {
      issues.push('Total memory size exceeds 80% of context window')
    }
    
    // Validate capabilities
    if (!agent.capabilities || agent.capabilities.length === 0) {
      issues.push('At least one capability is required')
    }
    
    const isValid = issues.length === 0
    
    // Update agent status based on validation
    await ctx.db.patch(args.id, {
      status: isValid ? 'ready' : 'error',
      updatedAt: Date.now(),
      metadata: {
        ...agent.metadata,
        validationIssues: issues,
        lastValidatedAt: Date.now()
      }
    })
    
    return {
      isValid,
      issues,
      agentId: args.id
    }
  }
})

// Clone agent
export const clone = mutation({
  args: {
    id: v.id('agents'),
    name: v.string(),
    projectId: v.optional(v.id('projects')),
    authUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { agent: sourceAgent } = await ensureAgentAccess(ctx, args.id, args.authUserId)
    
    const targetProjectId = args.projectId || sourceAgent.projectId
    
    // Verify target project access
    await ensureProjectAccess(ctx, targetProjectId, args.authUserId)
    
    const now = Date.now()
    
    // Clone the agent with reset performance metrics
    const clonedAgentId = await ctx.db.insert('agents', {
      projectId: targetProjectId,
      name: args.name,
      description: `Cloned from ${sourceAgent.name}`,
      role: sourceAgent.role,
      protocol: sourceAgent.protocol,
      workflowPattern: sourceAgent.workflowPattern,
      status: 'created',
      modelConfig: sourceAgent.modelConfig,
      memoryConfig: sourceAgent.memoryConfig,
      capabilities: sourceAgent.capabilities,
      performance: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0,
        totalTokensUsed: 0,
        totalCostIncurred: 0,
        memoryPeak: 0,
        executionTime: 0,
        recentSuccessRate: 0,
        recentAvgExecutionTime: 0
      },
      lastActiveAt: now,
      createdBy: args.authUserId || sourceAgent.createdBy,
      createdAt: now,
      updatedAt: now,
      metadata: {
        ...(sourceAgent.metadata || {}),
        clonedFrom: args.id,
        clonedAt: now
      }
    })
    
    return clonedAgentId
  }
})

// Get agents summary for project dashboard
export const getProjectSummary = query({
  args: { 
    projectId: v.id('projects'),
    authUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.projectId, args.authUserId)
    
    const cacheKey = `agent_summary:${args.projectId}`
    
    return await withCache(cacheKey, CACHE_TTL.SHORT, async () => {
      const agents = await ctx.db
        .query('agents')
        .withIndex('by_project', q => q.eq('projectId', args.projectId))
        .collect()
      
      // Calculate summary stats in memory (efficient)
      const summary = agents.reduce((acc, agent) => {
        acc.total++
        acc.byStatus[agent.status] = (acc.byStatus[agent.status] || 0) + 1
        acc.byRole[agent.role] = (acc.byRole[agent.role] || 0) + 1
        acc.byPattern[agent.workflowPattern] = (acc.byPattern[agent.workflowPattern] || 0) + 1
        acc.totalExecutions += agent.performance?.totalExecutions || 0
        acc.totalTokens += agent.performance?.totalTokensUsed || 0
        acc.totalCost += agent.performance?.totalCostIncurred || 0
        
        if (agent.lastActiveAt > acc.mostRecentActivity) {
          acc.mostRecentActivity = agent.lastActiveAt
        }
        
        return acc
      }, {
        total: 0,
        byStatus: {} as Record<string, number>,
        byRole: {} as Record<string, number>,
        byPattern: {} as Record<string, number>,
        totalExecutions: 0,
        totalTokens: 0,
        totalCost: 0,
        mostRecentActivity: 0
      })
      
      return {
        projectId: args.projectId,
        ...summary,
        avgTokensPerAgent: summary.total > 0 ? summary.totalTokens / summary.total : 0,
        avgCostPerAgent: summary.total > 0 ? summary.totalCost / summary.total : 0
      }
    })
  }
})

// Helper function to calculate performance score
function calculatePerformanceScore(
  agent: Doc<'agents'>, 
  metrics: { successRate: number; avgExecutionTime: number; avgLatency: number }
): number {
  const baseScore = 100
  
  // Penalize low success rate
  const successPenalty = (1 - metrics.successRate) * 30
  
  // Penalize high execution time (compared to baseline)
  const baselineTime = agent.performance?.avgExecutionTime || 10000 // 10s baseline
  const timePenalty = Math.max(0, (metrics.avgExecutionTime - baselineTime) / 1000) * 2
  
  // Penalize high latency
  const latencyPenalty = Math.max(0, (metrics.avgLatency - 1000) / 100) // Penalty after 1s
  
  const score = Math.max(0, baseScore - successPenalty - timePenalty - latencyPenalty)
  return Math.round(score)
}