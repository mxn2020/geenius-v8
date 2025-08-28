// convex/projects.ts - Project Management API

import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'

// Create a new project
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const projectId = await ctx.db.insert('projects', {
      name: args.name,
      description: args.description,
      status: 'active',
      createdBy: args.createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      configuration: {
        defaultTimeout: 1800000, // 30 minutes
        maxConcurrentExecutions: 5,
        errorHandling: 'fail-fast'
      },
      resourceLimits: {
        maxTokensPerExecution: 100000,
        maxCostPerExecution: 1.0,
        maxExecutionTime: 3600000 // 1 hour
      },
      statistics: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalTokensUsed: 0,
        totalCostIncurred: 0
      },
      metadata: args.metadata || {}
    })

    return projectId
  }
})

// Get all projects
export const list = query({
  args: {
    status: v.optional(v.union(v.literal('active'), v.literal('paused'), v.literal('completed'), v.literal('archived'))),
    limit: v.optional(v.number()),
    offset: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query('projects')
    
    if (args.status) {
      query = query.filter(q => q.eq(q.field('status'), args.status))
    }
    
    if (args.limit && !args.offset) {
      return await query.order('desc').take(args.limit)
    } else {
      const allResults = await query.order('desc').collect()
      if (args.offset) {
        return allResults.slice(args.offset, args.offset + (args.limit || allResults.length))
      }
      return allResults
    }
  }
})

// Get project by ID
export const getById = query({
  args: { id: v.id('projects') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  }
})

// Update project
export const update = mutation({
  args: {
    id: v.id('projects'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(v.literal('active'), v.literal('paused'), v.literal('completed'), v.literal('archived'))),
    configuration: v.optional(v.object({
      defaultTimeout: v.optional(v.number()),
      maxConcurrentExecutions: v.optional(v.number()),
      errorHandling: v.optional(v.union(v.literal('fail-fast'), v.literal('continue'), v.literal('retry-all')))
    })),
    resourceLimits: v.optional(v.object({
      maxTokensPerExecution: v.optional(v.number()),
      maxCostPerExecution: v.optional(v.number()),
      maxExecutionTime: v.optional(v.number())
    })),
    metadata: v.optional(v.record(v.string(), v.any()))
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args
    const project = await ctx.db.get(id)
    
    if (!project) {
      throw new Error('Project not found')
    }
    
    // Handle partial updates by merging with existing values
    const patchData: any = {
      updatedAt: Date.now()
    }
    
    if (updates.name) patchData.name = updates.name
    if (updates.description) patchData.description = updates.description
    if (updates.status) patchData.status = updates.status
    if (updates.metadata) patchData.metadata = updates.metadata
    
    if (updates.configuration) {
      patchData.configuration = {
        defaultTimeout: updates.configuration.defaultTimeout ?? project.configuration?.defaultTimeout ?? 1800000,
        maxConcurrentExecutions: updates.configuration.maxConcurrentExecutions ?? project.configuration?.maxConcurrentExecutions ?? 5,
        errorHandling: updates.configuration.errorHandling ?? project.configuration?.errorHandling ?? 'fail-fast'
      }
    }
    
    if (updates.resourceLimits) {
      patchData.resourceLimits = {
        maxTokensPerExecution: updates.resourceLimits.maxTokensPerExecution ?? project.resourceLimits?.maxTokensPerExecution ?? 100000,
        maxCostPerExecution: updates.resourceLimits.maxCostPerExecution ?? project.resourceLimits?.maxCostPerExecution ?? 1.0,
        maxExecutionTime: updates.resourceLimits.maxExecutionTime ?? project.resourceLimits?.maxExecutionTime ?? 3600000
      }
    }
    
    await ctx.db.patch(id, patchData)
    
    return id
  }
})

// Delete project
export const remove = mutation({
  args: { id: v.id('projects') },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id)
    if (!project) {
      throw new Error('Project not found')
    }
    
    // Check if project has active executions
    const activeExecutions = await ctx.db
      .query('executions')
      .withIndex('by_project', q => q.eq('projectId', args.id))
      .filter(q => q.eq(q.field('status'), 'running'))
      .collect()
    
    if (activeExecutions.length > 0) {
      throw new Error('Cannot delete project with active executions')
    }
    
    await ctx.db.delete(args.id)
    return true
  }
})

// Get project statistics
export const getStatistics = query({
  args: { 
    id: v.id('projects'),
    timeRange: v.optional(v.number()) // Time range in milliseconds
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id)
    if (!project) {
      throw new Error('Project not found')
    }
    
    const timeThreshold = args.timeRange ? Date.now() - args.timeRange : 0
    
    // Get executions within time range
    const executions = await ctx.db
      .query('executions')
      .withIndex('by_project', q => q.eq('projectId', args.id))
      .filter(q => q.gte(q.field('createdAt'), timeThreshold))
      .collect()
    
    // Calculate statistics
    const totalExecutions = executions.length
    const successfulExecutions = executions.filter(e => e.status === 'completed').length
    const failedExecutions = executions.filter(e => e.status === 'failed').length
    const runningExecutions = executions.filter(e => e.status === 'running').length
    
    // Get token usage
    const tokenUsage = await ctx.db
      .query('tokenUsage')
      .withIndex('by_project', q => q.eq('projectId', args.id))
      .filter(q => q.gte(q.field('timestamp'), timeThreshold))
      .collect()
    
    const totalTokensUsed = tokenUsage.reduce((sum, usage) => sum + usage.totalTokens, 0)
    const totalCostIncurred = tokenUsage.reduce((sum, usage) => sum + (usage.cost || 0), 0)
    
    // Get performance metrics
    const avgExecutionTime = executions.length > 0 
      ? executions
          .filter(e => e.completedAt && e.startedAt)
          .reduce((sum, e) => sum + (e.completedAt! - e.startedAt!), 0) / executions.length
      : 0
    
    return {
      projectId: args.id,
      timeRange: args.timeRange,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      runningExecutions,
      successRate: totalExecutions > 0 ? successfulExecutions / totalExecutions : 0,
      totalTokensUsed,
      totalCostIncurred,
      avgExecutionTime,
      costPerExecution: totalExecutions > 0 ? totalCostIncurred / totalExecutions : 0,
      tokensPerExecution: totalExecutions > 0 ? totalTokensUsed / totalExecutions : 0
    }
  }
})

// Get project agents
export const getAgents = query({
  args: { id: v.id('projects') },
  handler: async (ctx, args) => {
    const agents = await ctx.db
      .query('agents')
      .withIndex('by_project', q => q.eq('projectId', args.id))
      .collect()
    
    return agents
  }
})

// Get project executions
export const getExecutions = query({
  args: {
    id: v.id('projects'),
    status: v.optional(v.union(
      v.literal('pending'),
      v.literal('running'), 
      v.literal('completed'),
      v.literal('failed'),
      v.literal('cancelled')
    )),
    limit: v.optional(v.number()),
    offset: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query('executions')
      .withIndex('by_project', q => q.eq('projectId', args.id))
    
    if (args.status) {
      query = query.filter(q => q.eq(q.field('status'), args.status))
    }
    
    if (args.limit && !args.offset) {
      return await query.order('desc').take(args.limit)
    } else {
      const allResults = await query.order('desc').collect()
      if (args.offset) {
        return allResults.slice(args.offset, args.offset + (args.limit || allResults.length))
      }
      return allResults
    }
  }
})

// Update project statistics
export const updateStatistics = mutation({
  args: {
    id: v.id('projects'),
    executionDelta: v.optional(v.object({
      total: v.number(),
      successful: v.number(),
      failed: v.number()
    })),
    resourceDelta: v.optional(v.object({
      tokens: v.number(),
      cost: v.number()
    }))
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id)
    if (!project) {
      throw new Error('Project not found')
    }
    
    const updates: any = {
      updatedAt: Date.now()
    }
    
    if (args.executionDelta) {
      const currentStats = project.statistics || {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalTokensUsed: 0,
        totalCostIncurred: 0
      }
      updates.statistics = {
        ...currentStats,
        totalExecutions: currentStats.totalExecutions + args.executionDelta.total,
        successfulExecutions: currentStats.successfulExecutions + args.executionDelta.successful,
        failedExecutions: currentStats.failedExecutions + args.executionDelta.failed
      }
    }
    
    if (args.resourceDelta) {
      if (!updates.statistics) {
        updates.statistics = project.statistics || {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalTokensUsed: 0,
          totalCostIncurred: 0
        }
      }
      updates.statistics.totalTokensUsed += args.resourceDelta.tokens
      updates.statistics.totalCostIncurred += args.resourceDelta.cost
    }
    
    await ctx.db.patch(args.id, updates)
    return args.id
  }
})

// Archive old projects
export const archiveOldProjects = mutation({
  args: {
    olderThanDays: v.number()
  },
  handler: async (ctx, args) => {
    const cutoffTime = Date.now() - (args.olderThanDays * 24 * 60 * 60 * 1000)
    
    const oldProjects = await ctx.db
      .query('projects')
      .filter(q => 
        q.and(
          q.lt(q.field('updatedAt'), cutoffTime),
          q.or(
            q.eq(q.field('status'), 'completed'),
            q.eq(q.field('status'), 'paused')
          )
        )
      )
      .collect()
    
    const archivedIds = []
    for (const project of oldProjects) {
      await ctx.db.patch(project._id, { status: 'archived', updatedAt: Date.now() })
      archivedIds.push(project._id)
    }
    
    return archivedIds
  }
})