// convex/maintenance.ts - Internal maintenance tasks
import { internalMutation } from './_generated/server'
import { v } from 'convex/values'
import { cleanCache as cleanCacheUtil, DEFAULT_TIMEOUTS } from './utils/base'

// Clean up old executions
export const cleanupOldExecutions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - (DEFAULT_TIMEOUTS.CLEANUP_DAYS * 24 * 60 * 60 * 1000)
    const keepStatuses = ['running', 'pending']
    
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
    
    let deletedCount = 0
    for (const execution of oldExecutions) {
      await ctx.db.delete(execution._id)
      deletedCount++
    }
    
    console.log(`Cleaned up ${deletedCount} old executions`)
    return { deletedCount }
  }
})

// Clean up old performance metrics
export const cleanupPerformanceMetrics = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - (90 * 24 * 60 * 60 * 1000) // 90 days
    
    const oldMetrics = await ctx.db
      .query('performanceMetrics')
      .filter(q => q.lt(q.field('timestamp'), cutoffTime))
      .collect()
    
    let deletedCount = 0
    for (const metric of oldMetrics) {
      await ctx.db.delete(metric._id)
      deletedCount++
    }
    
    console.log(`Cleaned up ${deletedCount} old performance metrics`)
    return { deletedCount }
  }
})

// Clean up old token usage records
export const cleanupTokenUsage = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - (90 * 24 * 60 * 60 * 1000) // 90 days
    
    const oldTokenUsage = await ctx.db
      .query('tokenUsage')
      .filter(q => q.lt(q.field('timestamp'), cutoffTime))
      .collect()
    
    let deletedCount = 0
    for (const usage of oldTokenUsage) {
      await ctx.db.delete(usage._id)
      deletedCount++
    }
    
    console.log(`Cleaned up ${deletedCount} old token usage records`)
    return { deletedCount }
  }
})

// Clean up old audit logs
export const cleanupAuditLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - (365 * 24 * 60 * 60 * 1000) // 1 year
    
    const oldLogs = await ctx.db
      .query('auditLogs')
      .filter(q => 
        q.and(
          q.lt(q.field('timestamp'), cutoffTime),
          q.neq(q.field('severity'), 'critical') // Keep critical logs longer
        )
      )
      .collect()
    
    let deletedCount = 0
    for (const log of oldLogs) {
      await ctx.db.delete(log._id)
      deletedCount++
    }
    
    console.log(`Cleaned up ${deletedCount} old audit logs`)
    return { deletedCount }
  }
})

// Update agent performance scores
export const updateAgentPerformanceScores = internalMutation({
  args: {},
  handler: async (ctx) => {
    const agents = await ctx.db
      .query('agents')
      .filter(q => q.neq(q.field('status'), 'archived'))
      .collect()
    
    let updatedCount = 0
    const now = Date.now()
    const oneHourAgo = now - (60 * 60 * 1000)
    
    for (const agent of agents) {
      // Get recent executions for this agent
      const recentExecutions = await ctx.db
        .query('executions')
        .withIndex('by_agent', q => q.eq('agentId', agent._id))
        .filter(q => q.gte(q.field('createdAt'), oneHourAgo))
        .collect()
      
      if (recentExecutions.length > 0) {
        // Calculate new performance metrics
        const successful = recentExecutions.filter(e => e.status === 'completed').length
        const total = recentExecutions.length
        const successRate = total > 0 ? successful / total : 0
        
        const avgExecutionTime = recentExecutions
          .filter(e => e.completedAt && e.startedAt)
          .reduce((sum, e, _, arr) => 
            sum + (e.completedAt! - e.startedAt!) / arr.length, 0
          ) || 0
        
        // Update agent with new metrics
        await ctx.db.patch(agent._id, {
          performance: {
            ...agent.performance,
            recentSuccessRate: successRate,
            recentAvgExecutionTime: avgExecutionTime
          },
          lastActiveAt: now,
          updatedAt: now
        })
        
        updatedCount++
      }
    }
    
    console.log(`Updated performance for ${updatedCount} agents`)
    return { updatedCount }
  }
})

// Archive old completed projects
export const archiveOldProjects = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoffTime = Date.now() - (180 * 24 * 60 * 60 * 1000) // 180 days
    
    const oldProjects = await ctx.db
      .query('projects')
      .filter(q => 
        q.and(
          q.lt(q.field('updatedAt'), cutoffTime),
          q.eq(q.field('status'), 'completed')
        )
      )
      .collect()
    
    let archivedCount = 0
    for (const project of oldProjects) {
      // Check if project has any active executions
      const activeExecutions = await ctx.db
        .query('executions')
        .withIndex('by_project', q => q.eq('projectId', project._id))
        .filter(q => 
          q.or(
            q.eq(q.field('status'), 'running'),
            q.eq(q.field('status'), 'pending')
          )
        )
        .collect()
      
      // Only archive if no active executions
      if (activeExecutions.length === 0) {
        await ctx.db.patch(project._id, {
          status: 'archived',
          updatedAt: Date.now()
        })
        archivedCount++
      }
    }
    
    console.log(`Archived ${archivedCount} old projects`)
    return { archivedCount }
  }
})

// Clean in-memory cache
export const cleanCache = internalMutation({
  args: {},
  handler: async (ctx) => {
    cleanCacheUtil()
    console.log('Cache cleaned')
    return { success: true }
  }
})

// Comprehensive health check
export const healthCheck = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now()
    
    // Get system counts
    const [users, projects, agents, executions] = await Promise.all([
      ctx.db.query('users').collect(),
      ctx.db.query('projects').collect(),
      ctx.db.query('agents').collect(),
      ctx.db.query('executions').collect()
    ])
    
    // Get recent activity (last 24 hours)
    const oneDayAgo = now - (24 * 60 * 60 * 1000)
    const recentExecutions = executions.filter(e => e.createdAt > oneDayAgo)
    const runningExecutions = executions.filter(e => e.status === 'running')
    const stuckExecutions = executions.filter(e => 
      e.status === 'running' && 
      e.startedAt && 
      (now - e.startedAt) > (2 * 60 * 60 * 1000) // Running for more than 2 hours
    )
    
    // Calculate success rates
    const completedExecutions = executions.filter(e => e.status === 'completed')
    const failedExecutions = executions.filter(e => e.status === 'failed')
    const totalFinished = completedExecutions.length + failedExecutions.length
    const successRate = totalFinished > 0 ? completedExecutions.length / totalFinished : 0
    
    const health = {
      timestamp: now,
      counts: {
        users: users.length,
        projects: projects.length,
        agents: agents.length,
        executions: executions.length
      },
      activity: {
        recentExecutions: recentExecutions.length,
        runningExecutions: runningExecutions.length,
        stuckExecutions: stuckExecutions.length
      },
      performance: {
        overallSuccessRate: successRate,
        completedExecutions: completedExecutions.length,
        failedExecutions: failedExecutions.length
      },
      status: stuckExecutions.length > 10 ? 'warning' : 'healthy'
    }
    
    console.log('System health check:', health)
    return health
  }
})

// Emergency cleanup - removes all data (for development only)
export const emergencyCleanup = internalMutation({
  args: { 
    confirmationCode: v.string() // Require confirmation
  },
  handler: async (ctx, args) => {
    // Safety check - only allow in development
    if (args.confirmationCode !== 'RESET_ALL_DATA_CONFIRM') {
      throw new Error('Invalid confirmation code')
    }
    
    // Get all collections
    const [users, projects, agents, executions, activities, metrics, tokens, logs] = await Promise.all([
      ctx.db.query('users').collect(),
      ctx.db.query('projects').collect(),
      ctx.db.query('agents').collect(),
      ctx.db.query('executions').collect(),
      ctx.db.query('agentActivities').collect(),
      ctx.db.query('performanceMetrics').collect(),
      ctx.db.query('tokenUsage').collect(),
      ctx.db.query('auditLogs').collect()
    ])
    
    // Delete everything except system users (preserve admin accounts)
    const deletionTasks = [
      ...logs.map(item => ctx.db.delete(item._id)),
      ...tokens.map(item => ctx.db.delete(item._id)),
      ...metrics.map(item => ctx.db.delete(item._id)),
      ...activities.map(item => ctx.db.delete(item._id)),
      ...executions.map(item => ctx.db.delete(item._id)),
      ...agents.map(item => ctx.db.delete(item._id)),
      ...projects.map(item => ctx.db.delete(item._id)),
      // Keep system users, only delete non-admin users
      ...users.filter(u => !u.email?.includes('admin')).map(item => ctx.db.delete(item._id))
    ]
    
    await Promise.all(deletionTasks)
    
    const deletedCounts = {
      users: users.filter(u => !u.email?.includes('admin')).length,
      projects: projects.length,
      agents: agents.length,
      executions: executions.length,
      activities: activities.length,
      metrics: metrics.length,
      tokens: tokens.length,
      logs: logs.length
    }
    
    console.log('Emergency cleanup completed:', deletedCounts)
    return { success: true, deletedCounts }
  }
})

// Fix existing users missing createdBy field
export const fixUserSchemaIssues = internalMutation({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query('users').collect()
    let fixedCount = 0
    
    for (const user of users) {
      // Fix users missing createdBy field
      if (!user.createdBy) {
        await ctx.db.patch(user._id, {
          createdBy: user.authUserId, // Users create themselves
          updatedAt: Date.now()
        })
        fixedCount++
      }
    }
    
    console.log(`Fixed ${fixedCount} users missing createdBy field`)
    return { fixedCount }
  }
})