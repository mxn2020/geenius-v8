// convex/executions.ts - Execution Control API

import { v } from 'convex/values'
import { mutation, query, action } from './_generated/server'
import { api } from './_generated/api'
import { Id } from './_generated/dataModel'

// Create a new execution
export const create = mutation({
  args: {
    projectId: v.id('projects'),
    agentId: v.optional(v.id('agents')),
    workflowDefinition: v.object({
      name: v.string(),
      pattern: v.union(
        v.literal('sequential'),
        v.literal('routing'),
        v.literal('parallel'),
        v.literal('orchestrator-worker'),
        v.literal('evaluator-optimizer'),
        v.literal('multi-step-tool')
      ),
      steps: v.array(v.object({
        id: v.string(),
        name: v.string(),
        agentId: v.string(),
        input: v.optional(v.record(v.string(), v.any())),
        condition: v.optional(v.string()),
        retry: v.optional(v.object({
          maxAttempts: v.number(),
          backoffMs: v.number()
        }))
      })),
      agents: v.array(v.object({
        agentId: v.string(),
        role: v.union(v.literal('planner'), v.literal('director'), v.literal('coordinator'), v.literal('expert'), v.literal('builder')),
        config: v.record(v.string(), v.any()),
        dependencies: v.array(v.string())
      }))
    }),
    input: v.optional(v.record(v.string(), v.any())),
    configuration: v.optional(v.object({
      timeout: v.optional(v.number()),
      maxConcurrency: v.optional(v.number()),
      errorHandling: v.optional(v.union(v.literal('fail-fast'), v.literal('continue'), v.literal('retry-all'))),
      saveIntermediateResults: v.optional(v.boolean())
    })),
    priority: v.optional(v.union(v.literal('low'), v.literal('normal'), v.literal('high'), v.literal('urgent'))),
    metadata: v.optional(v.record(v.string(), v.any()))
  },
  handler: async (ctx, args) => {
    // Verify project exists
    const project = await ctx.db.get(args.projectId)
    if (!project) {
      throw new Error('Project not found')
    }
    
    // Verify agent exists if specified
    if (args.agentId) {
      const agent = await ctx.db.get(args.agentId)
      if (!agent) {
        throw new Error('Agent not found')
      }
      if (agent.projectId !== args.projectId) {
        throw new Error('Agent does not belong to the specified project')
      }
    }
    
    // Create execution record
    const executionId = await ctx.db.insert('executions', {
      projectId: args.projectId,
      agentId: args.agentId,
      status: 'pending',
      workflowDefinition: args.workflowDefinition,
      input: args.input || {},
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
        totalTokensUsed: 0,
        totalCostIncurred: 0,
        executionTime: 0,
        memoryPeak: 0
      },
      createdBy: args.metadata?.createdBy || 'system',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      startedAt: undefined,
      completedAt: undefined,
      metadata: args.metadata || {}
    })
    
    return executionId
  }
})

// Get all executions
export const list = query({
  args: {
    projectId: v.optional(v.id('projects')),
    agentId: v.optional(v.id('agents')),
    status: v.optional(v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('cancelled'),
      v.literal('timeout')
    )),
    priority: v.optional(v.union(v.literal('low'), v.literal('normal'), v.literal('high'), v.literal('urgent'))),
    limit: v.optional(v.number()),
    offset: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    // Build filters  
    let executions
    
    if (args.projectId) {
      executions = await ctx.db
        .query('executions')
        .withIndex('by_project', q => q.eq('projectId', args.projectId!))
        .order('desc')
        .collect()
    } else {
      executions = await ctx.db
        .query('executions')
        .order('desc')
        .collect()
    }
    
    // Apply additional filters
    if (args.agentId) {
      executions = executions.filter(e => e.agentId === args.agentId)
    }
    
    if (args.status) {
      executions = executions.filter(e => e.status === args.status)
    }
    
    if (args.priority) {
      executions = executions.filter(e => e.priority === args.priority)
    }
    
    // Apply pagination
    if (args.offset) {
      executions = executions.slice(args.offset, args.offset + (args.limit || executions.length))
    } else if (args.limit) {
      executions = executions.slice(0, args.limit)
    }
    
    return executions
  }
})

// Get execution by ID
export const getById = query({
  args: { id: v.id('executions') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  }
})

// Update execution status
export const updateStatus = mutation({
  args: {
    id: v.id('executions'),
    status: v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('cancelled'),
      v.literal('timeout')
    ),
    progress: v.optional(v.object({
      currentStep: v.optional(v.number()),
      percentage: v.optional(v.number()),
      completedSteps: v.optional(v.array(v.string())),
      failedSteps: v.optional(v.array(v.string())),
      activeSteps: v.optional(v.array(v.string()))
    })),
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
      memoryPeak: v.optional(v.number())
    })),
    error: v.optional(v.object({
      name: v.string(),
      message: v.string(),
      stack: v.optional(v.string()),
      code: v.optional(v.string()),
      stepId: v.optional(v.string())
    }))
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args
    const execution = await ctx.db.get(id)
    
    if (!execution) {
      throw new Error('Execution not found')
    }
    
    const patchData: any = {
      status: updates.status,
      updatedAt: Date.now()
    }
    
    // Handle status-specific updates
    if (updates.status === 'running' && execution.status === 'pending') {
      patchData.startedAt = Date.now()
    }
    
    if (['completed', 'failed', 'cancelled', 'timeout'].includes(updates.status)) {
      patchData.completedAt = Date.now()
      if (execution.startedAt) {
        patchData.performance = {
          ...execution.performance,
          executionTime: patchData.completedAt - execution.startedAt,
          ...updates.performance
        }
      }
    }
    
    // Merge progress updates
    if (updates.progress) {
      patchData.progress = {
        ...execution.progress,
        ...updates.progress
      }
    }
    
    // Merge results updates
    if (updates.results) {
      patchData.results = {
        ...(execution.results || { stepResults: {}, intermediateOutputs: [], finalResult: null }),
        ...updates.results,
        stepResults: {
          ...(execution.results?.stepResults || {}),
          ...updates.results.stepResults
        }
      }
    }
    
    // Merge performance updates
    if (updates.performance) {
      patchData.performance = {
        ...execution.performance,
        ...updates.performance
      }
    }
    
    // Add error information
    if (updates.error) {
      patchData.error = updates.error
    }
    
    await ctx.db.patch(id, patchData)
    return id
  }
})

// Cancel execution
export const cancel = mutation({
  args: {
    id: v.id('executions'),
    reason: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.id)
    if (!execution) {
      throw new Error('Execution not found')
    }
    
    if (!['pending', 'running'].includes(execution.status)) {
      throw new Error('Can only cancel pending or running executions')
    }
    
    await ctx.db.patch(args.id, {
      status: 'cancelled',
      completedAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        ...(execution.metadata || {}),
        cancellationReason: args.reason,
        cancelledAt: Date.now()
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
      throw new Error('Execution not found')
    }
    
    if (execution.status !== 'pending') {
      throw new Error('Execution must be in pending status to start')
    }
    
    // Update status to running
    await ctx.runMutation(api.executions.updateStatus, {
      id: args.id,
      status: 'running'
    })
    
    try {
      // Here you would integrate with the execution engine
      // For now, we'll simulate the workflow execution
      
      // Simulate processing steps
      const steps = execution.workflowDefinition?.steps || []
      let completedSteps: string[] = []
      let stepResults: Record<string, any> = {}
      
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        
        // Update progress
        await ctx.runMutation(api.executions.updateStatus, {
          id: args.id,
          status: 'running',
          progress: {
            currentStep: i + 1,
            percentage: (i + 1) / steps.length,
            activeSteps: [step.id]
          }
        })
        
        // Simulate step processing (in real implementation, this would call the execution engine)
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
        
        // Mock step result
        const stepResult = {
          output: `Result from ${step.name}`,
          timestamp: Date.now(),
          tokensUsed: Math.floor(Math.random() * 500) + 100,
          cost: Math.random() * 0.01
        }
        
        completedSteps.push(step.id)
        stepResults[step.id] = stepResult.output
        
        // Update step completion
        await ctx.runMutation(api.executions.updateStatus, {
          id: args.id,
          status: 'running',
          progress: {
            completedSteps,
            activeSteps: []
          },
          results: {
            stepResults,
            intermediateOutputs: [{
              stepId: step.id,
              timestamp: stepResult.timestamp,
              output: stepResult.output,
              metadata: {}
            }]
          },
          performance: {
            totalTokensUsed: stepResult.tokensUsed,
            totalCostIncurred: stepResult.cost
          }
        })
      }
      
      // Mark as completed
      await ctx.runMutation(api.executions.updateStatus, {
        id: args.id,
        status: 'completed',
        progress: {
          percentage: 1,
          currentStep: steps.length
        },
        results: {
          finalResult: {
            status: 'success',
            completedSteps: completedSteps.length,
            totalSteps: steps.length,
            results: stepResults
          }
        }
      })
      
      // Update project statistics
      await ctx.runMutation(api.projects.updateStatistics, {
        id: execution.projectId,
        executionDelta: { total: 1, successful: 1, failed: 0 },
        resourceDelta: { tokens: 1000, cost: 0.05 }
      })
      
      return { success: true, executionId: args.id }
      
    } catch (error) {
      // Handle execution failure
      await ctx.runMutation(api.executions.updateStatus, {
        id: args.id,
        status: 'failed',
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack
        }
      })
      
      // Update project statistics
      await ctx.runMutation(api.projects.updateStatistics, {
        id: execution.projectId,
        executionDelta: { total: 1, successful: 0, failed: 1 }
      })
      
      throw error
    }
  }
})

// Get execution logs
export const getLogs = query({
  args: {
    id: v.id('executions'),
    level: v.optional(v.union(v.literal('debug'), v.literal('info'), v.literal('warn'), v.literal('error'))),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    // Get logs from audit system  
    const auditLogs = await ctx.db
      .query('auditLogs')
      .filter(q => q.eq(q.field('executionId'), args.id))
      .order('desc')
      .collect()
    
    let filteredLogs = auditLogs
    
    if (args.level) {
      filteredLogs = auditLogs.filter(log => log.severity === args.level)
    }
    
    if (args.limit) {
      filteredLogs = filteredLogs.slice(0, args.limit)
    }
    
    return filteredLogs
  }
})

// Get execution metrics
export const getMetrics = query({
  args: { id: v.id('executions') },
  handler: async (ctx, args) => {
    const execution = await ctx.db.get(args.id)
    if (!execution) {
      throw new Error('Execution not found')
    }
    
    // Get performance metrics
    const performanceMetrics = await ctx.db
      .query('performanceMetrics')
      .filter(q => q.eq(q.field('executionId'), args.id))
      .collect()
    
    // Get token usage
    const tokenUsage = await ctx.db
      .query('tokenUsage')
      .filter(q => q.eq(q.field('executionId'), args.id))
      .collect()
    
    // Calculate aggregated metrics
    const totalTokens = tokenUsage.reduce((sum, usage) => sum + usage.totalTokens, 0)
    const totalCost = tokenUsage.reduce((sum, usage) => sum + (usage.cost || 0), 0)
    const avgLatency = performanceMetrics.length > 0
      ? performanceMetrics
          .filter(m => m.metricType === 'execution_time')
          .reduce((sum, m) => sum + m.value, 0) / performanceMetrics.length
      : 0
    
    return {
      executionId: args.id,
      status: execution.status,
      duration: execution.completedAt && execution.startedAt 
        ? execution.completedAt - execution.startedAt 
        : Date.now() - execution.createdAt,
      totalTokens,
      totalCost,
      avgLatency,
      stepMetrics: execution.progress,
      performance: execution.performance,
      resourceUsage: {
        memoryPeak: execution.performance?.memoryPeak || 0,
        tokensPerSecond: execution.startedAt && execution.completedAt
          ? totalTokens / ((execution.completedAt - execution.startedAt) / 1000)
          : 0
      }
    }
  }
})

// Retry failed execution
export const retry = action({
  args: {
    id: v.id('executions'),
    retryFailedStepsOnly: v.optional(v.boolean())
  },
  handler: async (ctx, args): Promise<Id<'executions'>> => {
    const execution = await ctx.runQuery(api.executions.getById, { id: args.id })
    if (!execution) {
      throw new Error('Execution not found')
    }
    
    if (execution.status !== 'failed') {
      throw new Error('Can only retry failed executions')
    }
    
    // Create new execution based on the failed one
    const retryExecutionId: Id<'executions'> = await ctx.runMutation(api.executions.create, {
      projectId: execution.projectId,
      agentId: execution.agentId,
      workflowDefinition: {
        name: execution.workflowDefinition!.name,
        pattern: execution.workflowDefinition!.pattern as 'sequential' | 'routing' | 'parallel' | 'orchestrator-worker' | 'evaluator-optimizer' | 'multi-step-tool',
        steps: execution.workflowDefinition!.steps.map(step => ({
          id: step.id,
          name: step.name,
          agentId: step.agentId,
          input: step.input,
          condition: step.condition,
          retry: step.retry
        })),
        agents: execution.workflowDefinition!.agents.map(agent => ({
          agentId: agent.agentId,
          role: agent.role as 'planner' | 'director' | 'coordinator' | 'expert' | 'builder',
          config: agent.config,
          dependencies: agent.dependencies
        }))
      },
      input: execution.input,
      configuration: execution.configuration ? {
        timeout: execution.configuration.timeout,
        maxConcurrency: execution.configuration.maxConcurrency,
        errorHandling: execution.configuration.errorHandling as 'fail-fast' | 'continue' | 'retry-all' | undefined,
        saveIntermediateResults: execution.configuration.saveIntermediateResults
      } : undefined,
      priority: execution.priority as 'low' | 'normal' | 'high' | 'urgent' | undefined,
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
    projectId: v.optional(v.id('projects'))
  },
  handler: async (ctx, args) => {
    let executions
    
    if (args.projectId) {
      executions = await ctx.db
        .query('executions')
        .withIndex('by_project', q => q.eq('projectId', args.projectId!))
        .collect()
    } else {
      executions = await ctx.db.query('executions').collect()
    }
    
    const pending = executions.filter(e => e.status === 'pending').length
    const running = executions.filter(e => e.status === 'running').length
    const completed = executions.filter(e => e.status === 'completed').length
    const failed = executions.filter(e => e.status === 'failed').length
    const cancelled = executions.filter(e => e.status === 'cancelled').length
    
    // Calculate queue statistics
    const avgWaitTime = executions
      .filter(e => e.startedAt && e.status !== 'pending')
      .reduce((sum, e) => sum + (e.startedAt! - e.createdAt), 0) / Math.max(1, executions.length)
    
    const avgExecutionTime = executions
      .filter(e => e.completedAt && e.startedAt)
      .reduce((sum, e) => sum + (e.completedAt! - e.startedAt!), 0) / 
      Math.max(1, executions.filter(e => e.completedAt && e.startedAt).length)
    
    return {
      projectId: args.projectId,
      queue: {
        pending,
        running,
        completed,
        failed,
        cancelled,
        total: executions.length
      },
      performance: {
        avgWaitTime,
        avgExecutionTime,
        throughput: completed / Math.max(1, (Date.now() - Math.min(...executions.map(e => e.createdAt))) / (24 * 60 * 60 * 1000)) // per day
      }
    }
  }
})

// Clean up old executions
export const cleanup = mutation({
  args: {
    olderThanDays: v.number(),
    keepStatuses: v.optional(v.array(v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('cancelled'),
      v.literal('timeout')
    )))
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