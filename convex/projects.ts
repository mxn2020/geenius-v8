// convex/projects.ts - Clean project management API
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id, Doc } from './_generated/dataModel'
import {
  ensureEntityExists,
  ensureProjectAccess,
  validatePagination,
  validateDateRange,
  calculateExecutionMetrics,
  BusinessLogicError,
  PaginatedResponse,
  DEFAULT_PAGINATION,
  CACHE_TTL,
  withCache
} from './utils/base'
import { 
  paginationArgs, 
  filterArgs,
  projectConfigSchema,
  resourceLimitsSchema,
  statusSchemas
} from './utils/schemas'

// Create a new project
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    configuration: v.optional(projectConfigSchema),
    resourceLimits: v.optional(resourceLimitsSchema),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()

    const projectId = await ctx.db.insert('projects', {
      name: args.name,
      description: args.description,
      status: 'active',
      configuration: args.configuration || {
        defaultTimeout: 1800000, // 30 minutes
        maxConcurrentExecutions: 5,
        errorHandling: 'fail-fast'
      },
      resourceLimits: args.resourceLimits || {
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
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
      metadata: args.metadata || {}
    })

    return projectId
  }
})

// Get all projects with filtering and pagination
export const list = query({
  args: {
    ...paginationArgs,
    filters: v.optional(v.object({
      ...filterArgs,
      status: v.optional(statusSchemas.project)
    }))
  },
  handler: async (ctx, args): Promise<PaginatedResponse<Doc<'projects'>>> => {
    const { limit, offset } = validatePagination(args)
    
    let results: Doc<'projects'>[]
    
    // Apply filters with proper query construction
    if (args.filters?.createdBy) {
      results = await ctx.db
        .query('projects')
        .withIndex('createdBy', q => q.eq('createdBy', args.filters!.createdBy!))
        .order('desc')
        .collect()
    } else {
      results = await ctx.db
        .query('projects')
        .order('desc')
        .collect()
    }
    
    // Apply additional filters in memory
    if (args.filters) {
      results = results.filter(p => {
        if (args.filters!.status && p.status !== args.filters!.status) return false
        
        // Apply date range filter
        if (args.filters!.dateRange) {
          const dateRange = validateDateRange(args.filters!.dateRange)
          if (dateRange && (p.createdAt < dateRange.start || p.createdAt > dateRange.end)) {
            return false
          }
        }
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

// Get projects for a specific user
export const getUserProjects = query({
  args: {
    authUserId: v.string(),
    ...paginationArgs
  },
  handler: async (ctx, args): Promise<PaginatedResponse<Doc<'projects'>>> => {
    const { limit, offset } = validatePagination(args)
    
    const projects = await ctx.db
      .query('projects')
      .withIndex('createdBy', q => q.eq('createdBy', args.authUserId))
      .order('desc')
      .collect()
    
    return {
      data: projects.slice(offset, offset + limit),
      hasMore: projects.length > offset + limit,
      total: projects.length
    }
  }
})

// Get project by ID
export const getById = query({
  args: { 
    id: v.id('projects'),
    authUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    return await ensureProjectAccess(ctx, args.id, args.authUserId)
  }
})

// Update project
export const update = mutation({
  args: {
    id: v.id('projects'),
    authUserId: v.optional(v.string()),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(statusSchemas.project),
    configuration: v.optional(projectConfigSchema),
    resourceLimits: v.optional(resourceLimitsSchema),
    metadata: v.optional(v.record(v.string(), v.any()))
  },
  handler: async (ctx, args) => {
    const { id, authUserId, ...updates } = args
    const project = await ensureProjectAccess(ctx, id, authUserId)
    
    const updateData: any = { updatedAt: Date.now() }
    
    // Only include provided fields
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.description !== undefined) updateData.description = updates.description
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.metadata !== undefined) updateData.metadata = updates.metadata
    
    // Handle nested object updates
    if (updates.configuration) {
      updateData.configuration = {
        ...project.configuration,
        ...updates.configuration
      }
    }
    
    if (updates.resourceLimits) {
      updateData.resourceLimits = {
        ...project.resourceLimits,
        ...updates.resourceLimits
      }
    }
    
    await ctx.db.patch(id, updateData)
    return id
  }
})

// Delete project
export const remove = mutation({
  args: { 
    id: v.id('projects'),
    authUserId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const project = await ensureProjectAccess(ctx, args.id, args.authUserId)
    
    // Check for active executions
    const activeExecutions = await ctx.db
      .query('executions')
      .withIndex('project_status', q => 
        q.eq('projectId', args.id).eq('status', 'running')
      )
      .collect()
    
    if (activeExecutions.length > 0) {
      throw new BusinessLogicError('Cannot delete project with active executions')
    }
    
    await ctx.db.delete(args.id)
    return true
  }
})

// Get project statistics with caching
export const getStatistics = query({
  args: { 
    id: v.id('projects'),
    authUserId: v.optional(v.string()),
    timeRange: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.id, args.authUserId)
    
    const cacheKey = `project_stats:${args.id}:${args.timeRange || 'all'}`
    
    return await withCache(cacheKey, CACHE_TTL.MEDIUM, async () => {
      const timeThreshold = args.timeRange ? Date.now() - args.timeRange : 0
      
      // Get all project data in parallel
      const [project, executions, agents, tokenUsage] = await Promise.all([
        ctx.db.get(args.id),
        ctx.db
          .query('executions')
          .withIndex('by_project', q => q.eq('projectId', args.id))
          .filter(q => q.gte(q.field('createdAt'), timeThreshold))
          .collect(),
        ctx.db
          .query('agents')
          .withIndex('by_project', q => q.eq('projectId', args.id))
          .collect(),
        ctx.db
          .query('tokenUsage')
          .withIndex('by_project', q => q.eq('projectId', args.id))
          .filter(q => q.gte(q.field('timestamp'), timeThreshold))
          .collect()
      ])
      
      if (!project) {
        throw new Error('Project not found')
      }
      
      // Calculate metrics
      const executionMetrics = calculateExecutionMetrics(executions)
      const totalTokensUsed = tokenUsage.reduce((sum, usage) => sum + usage.totalTokens, 0)
      const totalCostIncurred = tokenUsage.reduce((sum, usage) => sum + (usage.cost || 0), 0)
      
      const agentStats = agents.reduce((acc, agent) => {
        acc.total++
        acc.byStatus[agent.status] = (acc.byStatus[agent.status] || 0) + 1
        acc.byRole[agent.role] = (acc.byRole[agent.role] || 0) + 1
        return acc
      }, {
        total: 0,
        byStatus: {} as Record<string, number>,
        byRole: {} as Record<string, number>
      })
      
      return {
        projectId: args.id,
        timeRange: args.timeRange,
        ...executionMetrics,
        totalTokensUsed,
        totalCostIncurred,
        costPerExecution: executionMetrics.total > 0 
          ? totalCostIncurred / executionMetrics.total 
          : 0,
        tokensPerExecution: executionMetrics.total > 0 
          ? totalTokensUsed / executionMetrics.total 
          : 0,
        agents: agentStats
      }
    })
  }
})

// Get project agents
export const getAgents = query({
  args: { 
    id: v.id('projects'),
    authUserId: v.optional(v.string()),
    ...paginationArgs
  },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.id, args.authUserId)
    
    const { limit, offset } = validatePagination(args)
    
    const agents = await ctx.db
      .query('agents')
      .withIndex('by_project', q => q.eq('projectId', args.id))
      .order('desc')
      .collect()
    
    return {
      data: agents.slice(offset, offset + limit),
      hasMore: agents.length > offset + limit,
      total: agents.length
    }
  }
})

// Get project executions
export const getExecutions = query({
  args: {
    id: v.id('projects'),
    authUserId: v.optional(v.string()),
    status: v.optional(statusSchemas.execution),
    ...paginationArgs
  },
  handler: async (ctx, args) => {
    await ensureProjectAccess(ctx, args.id, args.authUserId)
    
    const { limit, offset } = validatePagination(args)
    
    let query = ctx.db
      .query('executions')
      .withIndex('by_project', q => q.eq('projectId', args.id))
    
    if (args.status) {
      query = query.filter(q => q.eq(q.field('status'), args.status))
    }
    
    const executions = await query.order('desc').collect()
    
    return {
      data: executions.slice(offset, offset + limit),
      hasMore: executions.length > offset + limit,
      total: executions.length
    }
  }
})

// Update project statistics (internal use)
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
    const project = await ensureEntityExists(ctx, 'projects', args.id, 'Project')
    
    const updates: any = { updatedAt: Date.now() }
    
    if (args.executionDelta || args.resourceDelta) {
      const currentStats = project.statistics || {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalTokensUsed: 0,
        totalCostIncurred: 0
      }
      
      updates.statistics = { ...currentStats }
      
      if (args.executionDelta) {
        updates.statistics.totalExecutions += args.executionDelta.total
        updates.statistics.successfulExecutions += args.executionDelta.successful
        updates.statistics.failedExecutions += args.executionDelta.failed
      }
      
      if (args.resourceDelta) {
        updates.statistics.totalTokensUsed += args.resourceDelta.tokens
        updates.statistics.totalCostIncurred += args.resourceDelta.cost
      }
    }
    
    await ctx.db.patch(args.id, updates)
    return args.id
  }
})

// Archive old projects
export const archiveOldProjects = mutation({
  args: { olderThanDays: v.number() },
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
      await ctx.db.patch(project._id, { 
        status: 'archived', 
        updatedAt: Date.now() 
      })
      archivedIds.push(project._id)
    }
    
    return { archivedCount: archivedIds.length, archivedIds }
  }
})