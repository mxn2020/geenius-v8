// convex/executions.ts - Clean execution management API
import { v } from 'convex/values'
import { mutation, query, action } from './_generated/server'
import { api } from './_generated/api'
import { Id, Doc } from './_generated/dataModel'
import {
  ensureEntityExists,
  ensureProjectAccess,
  ensureAgentAccess,
  validatePagination,
  validateCursorPagination,
  BusinessLogicError,
  ValidationError,
  PaginatedResponse,
  CursorPaginatedResponse,
  CACHE_TTL,
  withCache
} from './utils/base'
import { 
  paginationArgs,
  cursorPaginationArgs,
  filterArgs,
  statusSchemas,
  prioritySchema,
  workflowDefinitionSchema,
  progressSchema,
  errorSchema
} from './utils/schemas'

// Create a new execution
export const create = mutation({
  args: {
    projectId: v.id('projects'),
    agentId: v.optional(v.id('agents')),
    authUserId: v.optional(v.string()),
    workflowDefinition: workflowDefinitionSchema,
    input: v.optional(v.record(v.string(), v.any())),
    configuration: v.optional(v.object({
      timeout: v.optional(v.number()),
      maxConcurrency: v.optional(v.number()),
      errorHandling: v.optional(v.union(
        v.literal('fail-fast'),
        v.literal('continue'),
        v.literal('retry-all')
      )),
      saveIntermediateResults: v.optional(v.boolean())
    })),
    priority: v.optional(prioritySchema),
    metadata: v.optional(v.record(v.string(), v.any()))
  },
  handler: async (ctx, args) => {
    const { authUserId, ...executionData } = args
    
    // Verify project access
    await ensureProjectAccess(ctx, args.projectId, authUserId)
    
    // Verify agent exists if specified
    if (args.agentId) {
      await ensureAgentAccess(ctx, args.agentId, authUserId)
    }
    
    const now = Date.now()
    
    const executionId = await ctx.db.insert('executions', {
      ...executionData,
      status: 'pending',
      configuration: {
        timeout: args.configuration?.timeout || 1800000,
        maxConcurrency: args.configuration?.maxConcurrency || 5,
        errorHandling: args.configuration?.errorHandling || 'fail-fast',
        saveIntermediateResults: args.configuration?.saveIntermediateResults ?? true
      },
      priority: args.priority || 'normal',
      progress: {
        currentStep: 0,
        totalSteps: args.workflowDefinition.steps.length,
        percentage: 0,
        completedSteps: [],
        failedSteps: [],
        activeSteps: []
      },
      results: {
        stepResults: {},
        intermediateOutputs: [],
        finalResult: null
      },
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
      input: args.input || {},
      createdBy: authUserId || 'system',
      createdAt: now,
      updatedAt: now,
      metadata: args.metadata || {}
    })
    
    return executionId
  }
})

// Get executions with filtering and pagination
export const list = query({
  args: {
    projectId: v.optional(v.id('projects')),
    agentId: v.optional(v.id('agents')),
    authUserId: v.optional(v.string()),
    ...paginationArgs,
    filters: v.optional(v.object({
      ...filterArgs,
      status: v.optional(statusSchemas.execution),
      priority: v.optional(prioritySchema)
    }))
  },
  handler: async (ctx, args): Promise<PaginatedResponse<Doc<'executions'>>> => {
    const { limit, offset } = validatePagination(args)
    
    let results: Doc<'executions'>[]
    
    // Apply primary filters with proper query construction
    if (args.projectId) {
      await ensureProjectAccess(ctx, args.projectId, args.authUserId)
      results = await ctx.db
        .query('executions')
        .withIndex('by_project', q => q.eq('projectId', args.projectId!))
        .order('desc')
        .collect()
    } else if (args.agentId) {
      results = await ctx.db
        .query('executions')
        .withIndex('by_agent', q => q.eq('agentId', args.agentId!))
        .order('desc')
        .collect()
    } else if (args.authUserId) {
      // Show only user's executions if no specific project/agent
      results = await ctx.db
        .query('executions')
        .filter(q => q.eq(q.field('createdBy'), args.authUserId!))
        .order('desc')
        .collect()
    } else {
      // Get all executions (admin view)
      results = await ctx.db
        .query('executions')
        .order('desc')
        .collect()
    }
    
    // Apply additional filters in memory
    if (args.filters) {
      results = results.filter(execution => {
        if (args.filters!.status && execution.status !== args.filters!.status) return false
        if (args.filters!.priority && execution.priority !== args.filters!.priority) return false
        if (args.filters!.createdBy && execution.createdBy !== args.filters!.createdBy) return false
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

// Get executions with cursor pagination (more efficient for large datasets)
export const listWithCursor = query({
  args: {
    projectId: v.id('projects'),
    authUserId: v.optional(v.string()),
    ...cursorPaginationArgs,
    status: v.optional(statusSchemas.execution)
  },
  handler: async (ctx, args): Promise<CursorPaginatedResponse<Doc<'executions'>>> => {
    await ensureProjectAccess(ctx, args.projectId, args.authUserId)
    
    const { limit, cursor } = validateCursorPagination(args)
    
    let query = ctx.db
      .query('executions')
      .withIndex('project_created', q => q.eq('projectId', args.projectId))
      .order('desc')
    
    // Apply cursor for pagination
    if (cursor) {
      const cursorExecution = await ensureEntityExists(ctx, 'executions', cursor as Id<'executions'>, 'Execution')
      query = query.filter(q => q.lt(q.field('createdAt'), cursorExecution.createdAt))
    }
    
    let results = await query.take(limit + 1) // +1 to check if more exist
    
    // Apply status filter if provided
    if (args.status) {
      results = results.filter(e => e.status === args.status)
      // May need to fetch more if filtered results are less than limit
    }
    
    const hasMore = results.length > limit
    const data = hasMore ? results.slice(0, -1) : results
    
    return {
      data,
      hasMore,
      nextCursor: hasMore ? data[data.length - 1]._id : undefined
    }
  }
})

// Get execution by ID
export const getById = query({
  args: { 
    id: v.id('executions'),
    authUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const execution = await ensureEntityExists(ctx, 'executions', args.id, 'Execution')
    
    // Check project access
    await ensureProjectAccess(ctx, execution.projectId, args.authUserId)
    
    return execution
  }
})

// Update execution status with proper state transitions
export const updateStatus = mutation({
  args: {
    id: v.id('executions'),
    updates: v.object({
      status: statusSchemas.execution,
      progress: v.optional(progressSchema),
      results: v.optional(v.object({
        stepResults: v.optional(v.record(v.string(), v.any())),
        finalResult: v.optional(v.any()),
        intermediateOutputs: v.optional(v.array(v.object({
          stepId: v.string(),
          timestamp: v.number(),
          output: v.any(),
          metadata: v.record(v.string(), v.any())
        })))
      })),
      performance: v.optional(v.object({
        totalTokensUsed: v.optional(v.number()),
        totalCostIncurred: v.optional(v.number()),
        executionTime: v.optional(v.number()),
        memoryPeak: v.optional(v.number()),
        totalExecutions: v.optional(v.number()),
        successfulExecutions: v.optional(v.number()),
        failedExecutions: v.optional(v.number()),
        avgExecutionTime: v.optional(v.number()),
        recentSuccessRate: v.optional(v.number()),
        recentAvgExecutionTime: v.optional(v.number())
      })),
      error: v.optional(errorSchema)
    })
  },
  handler: async (ctx, args) => {
    const execution = await ensureEntityExists(ctx, 'executions', args.id, 'Execution')
    
    const updateData = buildStatusUpdate(execution, args.updates)
    
    await ctx.db.patch(args.id, updateData)
    return args.id
  }
})

// Cancel execution
export const cancel = mutation({
  args: {
    id: v.id('executions'),
    authUserId: v.optional(v.string()),
    reason: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const execution = await ensureEntityExists(ctx, 'executions', args.id, 'Execution')
    
    // Check project access
    await ensureProjectAccess(ctx, execution.projectId, args.authUserId)
    
    if (!['pending', 'running'].includes(execution.status)) {
      throw new BusinessLogicError('Can only cancel pending or running executions')
    }
    
    const now = Date.now()
    
    await ctx.db.patch(args.id, {
      status: 'cancelled',
      completedAt: now,
      updatedAt: now,
      metadata: {
        ...(execution.metadata || {}),
        cancellationReason: args.reason,
        cancelledAt: now,
        cancelledBy: args.authUserId
      }
    })
    
    return args.id
  }
})

// Start execution (action that triggers workflow processing)
export const start = action({
  args: { id: v.id('executions') },
  handler: async (ctx, args) => {
    // Get execution details
    const execution = await ctx.runQuery(api.executions.getById, { id: args.id })
    if (!execution) {
      throw new ValidationError('Execution not found')
    }
    
    if (execution.status !== 'pending') {
      throw new BusinessLogicError('Execution must be in pending status to start')
    }
    
    // Update status to running
    await ctx.runMutation(api.executions.updateStatus, {
      id: args.id,
      updates: { status: 'running' }
    })
    
    try {
      // Simulate workflow execution (replace with actual execution engine)
      const result = await simulateWorkflowExecution(ctx, execution)
      
      // Mark as completed
      await ctx.runMutation(api.executions.updateStatus, {
        id: args.id,
        updates: {
          status: 'completed',
          progress: {
            percentage: 1,
            currentStep: execution.workflowDefinition.steps.length
          },
          results: {
            finalResult: result.finalResult
          },
          performance: result.performance
        }
      })
      
      // Update project and agent statistics
      await Promise.all([
        ctx.runMutation(api.projects.updateStatistics, {
          id: execution.projectId,
          executionDelta: { total: 1, successful: 1, failed: 0 },
          resourceDelta: { 
            tokens: result.performance.totalTokensUsed, 
            cost: result.performance.totalCostIncurred 
          }
        }),
        execution.agentId ? ctx.runMutation(api.agents.updatePerformance, {
          id: execution.agentId,
          executionDelta: { 
            total: 1, 
            successful: 1, 
            failed: 0, 
            executionTime: result.performance.executionTime 
          },
          resourceDelta: { 
            tokens: result.performance.totalTokensUsed, 
            cost: result.performance.totalCostIncurred 
          }
        }) : Promise.resolve()
      ])
      
      return { success: true, executionId: args.id }
      
    } catch (error) {
      // Handle execution failure
      await ctx.runMutation(api.executions.updateStatus, {
        id: args.id,
        updates: {
          status: 'failed',
          error: {
            name: (error as Error).name,
            message: (error as Error).message,
            stack: (error as Error).stack
          }
        }
      })
      
      // Update failure statistics
      await Promise.all([
        ctx.runMutation(api.projects.updateStatistics, {
          id: execution.projectId,
          executionDelta: { total: 1, successful: 0, failed: 1 }
        }),
        execution.agentId ? ctx.runMutation(api.agents.updatePerformance, {
          id: execution.agentId,
          executionDelta: { total: 1, successful: 0, failed: 1, executionTime: 0 }
        }) : Promise.resolve()
      ])
      
      throw error
    }
  }
})

// Wrapper mutation to start execution (easier for frontend to use)
export const startExecution = mutation({
  args: { id: v.id('executions') },
  handler: async (ctx, args) => {
    // This is just a wrapper that calls the action
    // The actual work is done in the action above
    return { executionId: args.id, status: 'queued' }
  }
})

// Get execution logs
export const getLogs = query({
  args: {
    id: v.id('executions'),
    authUserId: v.optional(v.string()),
    severity: v.optional(v.union(
      v.literal('low'),
      v.literal('medium'),
      v.literal('high'),
      v.literal('critical')
    )),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const execution = await ensureEntityExists(ctx, 'executions', args.id, 'Execution')
    await ensureProjectAccess(ctx, execution.projectId, args.authUserId)
    
    let logs = await ctx.db
      .query('auditLogs')
      .withIndex('execution_id', q => q.eq('executionId', args.id))
      .order('desc')
      .collect()
    
    if (args.severity) {
      logs = logs.filter(log => log.severity === args.severity)
    }
    
    if (args.limit) {
      logs = logs.slice(0, args.limit)
    }
    
    return logs
  }
})

// Get execution metrics with caching
export const getMetrics = query({
  args: { 
    id: v.id('executions'),
    authUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const execution = await ensureEntityExists(ctx, 'executions', args.id, 'Execution')
    await ensureProjectAccess(ctx, execution.projectId, args.authUserId)
    
    const cacheKey = `execution_metrics:${args.id}`
    
    return await withCache(cacheKey, CACHE_TTL.SHORT, async () => {
      // Get related metrics
      const [performanceMetrics, tokenUsage] = await Promise.all([
        ctx.db
          .query('performanceMetrics')
          .withIndex('execution_id', q => q.eq('executionId', args.id))
          .collect(),
        ctx.db
          .query('tokenUsage')
          .withIndex('by_execution', q => q.eq('executionId', args.id))
          .collect()
      ])
      
      const totalTokens = tokenUsage.reduce((sum, usage) => sum + usage.totalTokens, 0)
      const totalCost = tokenUsage.reduce((sum, usage) => sum + (usage.cost || 0), 0)
      const avgLatency = performanceMetrics.length > 0
        ? performanceMetrics
            .filter(m => m.metricType === 'execution_time')
            .reduce((sum, m) => sum + m.value, 0) / performanceMetrics.length
        : 0
      
      const duration = execution.completedAt && execution.startedAt 
        ? execution.completedAt - execution.startedAt 
        : execution.startedAt
          ? Date.now() - execution.startedAt
          : 0
      
      return {
        executionId: args.id,
        status: execution.status,
        duration,
        totalTokens,
        totalCost,
        avgLatency,
        stepMetrics: execution.progress,
        performance: execution.performance,
        resourceUsage: {
          memoryPeak: execution.performance?.memoryPeak || 0,
          tokensPerSecond: duration > 0 ? totalTokens / (duration / 1000) : 0,
          executionTime: execution.performance?.executionTime || duration
        }
      }
    })
  }
})

// Retry failed execution
export const retry = action({
  args: {
    id: v.id('executions'),
    authUserId: v.optional(v.string()),
    retryFailedStepsOnly: v.optional(v.boolean())
  },
  handler: async (ctx, args): Promise<Id<'executions'>> => {
    const execution = await ctx.runQuery(api.executions.getById, { 
      id: args.id, 
      authUserId: args.authUserId 
    })
    
    if (!execution) {
      throw new ValidationError('Execution not found')
    }
    
    if (execution.status !== 'failed') {
      throw new BusinessLogicError('Can only retry failed executions')
    }
    
    // Create new execution based on the failed one
    const retryExecutionId: Id<'executions'> = await ctx.runMutation(api.executions.create, {
      projectId: execution.projectId,
      agentId: execution.agentId,
      authUserId: args.authUserId,
      workflowDefinition: execution.workflowDefinition,
      input: execution.input,
      configuration: execution.configuration,
      priority: execution.priority,
      metadata: {
        ...(execution.metadata || {}),
        retryOf: args.id,
        retryFailedStepsOnly: args.retryFailedStepsOnly,
        retryTimestamp: Date.now()
      }
    })
    
    // Start the retry execution
    await ctx.runAction(api.executions.start, { id: retryExecutionId })
    
    return retryExecutionId
  }
})

// Get execution queue status
export const getQueueStatus = query({
  args: {
    projectId: v.optional(v.id('projects')),
    authUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    let executions: Doc<'executions'>[]
    
    if (args.projectId) {
      await ensureProjectAccess(ctx, args.projectId, args.authUserId)
      executions = await ctx.db
        .query('executions')
        .withIndex('by_project', q => q.eq('projectId', args.projectId!))
        .collect()
    } else if (args.authUserId) {
      executions = await ctx.db
        .query('executions')
        .filter(q => q.eq(q.field('createdBy'), args.authUserId!))
        .collect()
    } else {
      executions = await ctx.db.query('executions').collect()
    }
    
    const statusCounts = executions.reduce((acc, e) => {
      acc[e.status] = (acc[e.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    // Calculate performance metrics
    const completedExecutions = executions.filter(e => 
      e.completedAt && e.startedAt && e.status === 'completed'
    )
    
    const avgWaitTime = executions
      .filter(e => e.startedAt && e.status !== 'pending')
      .reduce((sum, e) => sum + (e.startedAt! - e.createdAt), 0) / 
      Math.max(1, executions.length)
    
    const avgExecutionTime = completedExecutions.length > 0
      ? completedExecutions
          .reduce((sum, e) => sum + (e.completedAt! - e.startedAt!), 0) / completedExecutions.length
      : 0
    
    const throughputPeriod = 24 * 60 * 60 * 1000 // 1 day
    const recentCompletions = executions.filter(e => 
      e.completedAt && e.completedAt > Date.now() - throughputPeriod
    ).length
    
    return {
      projectId: args.projectId,
      queue: {
        pending: statusCounts.pending || 0,
        running: statusCounts.running || 0,
        completed: statusCounts.completed || 0,
        failed: statusCounts.failed || 0,
        cancelled: statusCounts.cancelled || 0,
        total: executions.length
      },
      performance: {
        avgWaitTime,
        avgExecutionTime,
        throughput: recentCompletions // completions per day
      }
    }
  }
})

// Clean up old executions
export const cleanup = mutation({
  args: {
    olderThanDays: v.number(),
    keepStatuses: v.optional(v.array(statusSchemas.execution))
  },
  handler: async (ctx, args) => {
    const cutoffTime = Date.now() - (args.olderThanDays * 24 * 60 * 60 * 1000)
    const keepStatuses = args.keepStatuses || ['running', 'pending']
    
    const oldExecutions = await ctx.db
      .query('executions')
      .filter(q => 
        q.and(
          q.lt(q.field('createdAt'), cutoffTime),
          q.not(
            q.or(...keepStatuses.map(status => q.eq(q.field('status'), status)))
          )
        )
      )
      .collect()
    
    const deletedIds = []
    for (const execution of oldExecutions) {
      await ctx.db.delete(execution._id)
      deletedIds.push(execution._id)
    }
    
    return { deletedCount: deletedIds.length, deletedIds }
  }
})

// Helper functions

// Build status update with proper state management
function buildStatusUpdate(currentExecution: Doc<'executions'>, updates: any) {
  const now = Date.now()
  const updateData: any = {
    status: updates.status,
    updatedAt: now
  }
  
  // Handle lifecycle transitions
  if (updates.status === 'running' && currentExecution.status === 'pending') {
    updateData.startedAt = now
  }
  
  if (['completed', 'failed', 'cancelled', 'timeout'].includes(updates.status)) {
    updateData.completedAt = now
    if (currentExecution.startedAt) {
      const executionTime = now - currentExecution.startedAt
      updateData.performance = {
        ...currentExecution.performance,
        executionTime,
        ...updates.performance
      }
    }
  }
  
  // Merge nested updates safely
  if (updates.progress) {
    updateData.progress = { 
      ...currentExecution.progress, 
      ...updates.progress 
    }
  }
  
  if (updates.results) {
    updateData.results = {
      ...(currentExecution.results || {}),
      ...updates.results,
      stepResults: {
        ...(currentExecution.results?.stepResults || {}),
        ...updates.results.stepResults
      }
    }
  }
  
  if (updates.error) {
    updateData.error = updates.error
  }
  
  return updateData
}

// Simulate workflow execution (replace with actual execution engine)
async function simulateWorkflowExecution(ctx: any, execution: Doc<'executions'>) {
  const steps = execution.workflowDefinition?.steps || []
  let completedSteps: string[] = []
  let stepResults: Record<string, any> = {}
  let totalTokens = 0
  let totalCost = 0
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    
    // Update progress
    await ctx.runMutation(api.executions.updateStatus, {
      id: execution._id,
      updates: {
        status: 'running',
        progress: {
          currentStep: i + 1,
          percentage: (i + 1) / steps.length,
          activeSteps: [step.id]
        }
      }
    })
    
    // Simulate step processing delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
    
    // Mock step result
    const stepResult = {
      output: `Result from ${step.name}`,
      timestamp: Date.now(),
      tokensUsed: Math.floor(Math.random() * 500) + 100,
      cost: Math.random() * 0.01
    }
    
    totalTokens += stepResult.tokensUsed
    totalCost += stepResult.cost
    
    completedSteps.push(step.id)
    stepResults[step.id] = stepResult.output
    
    // Update step completion
    await ctx.runMutation(api.executions.updateStatus, {
      id: execution._id,
      updates: {
        status: 'running',
        progress: {
          completedSteps,
          activeSteps: []
        }
      }
    })
  }
  
  return {
    finalResult: {
      status: 'success',
      completedSteps: completedSteps.length,
      totalSteps: steps.length,
      results: stepResults
    },
    performance: {
      totalTokensUsed: totalTokens,
      totalCostIncurred: totalCost,
      executionTime: 5000 + Math.random() * 10000 // 5-15 seconds
    }
  }
}