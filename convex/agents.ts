// convex/agents.ts - Agent Configuration API

import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { Id } from './_generated/dataModel'

// Create a new agent
export const create = mutation({
  args: {
    projectId: v.id('projects'),
    name: v.string(),
    description: v.optional(v.string()),
    role: v.union(v.literal('planner'), v.literal('director'), v.literal('coordinator'), v.literal('expert'), v.literal('builder')),
    protocol: v.string(),
    workflowPattern: v.union(
      v.literal('sequential'),
      v.literal('routing'),
      v.literal('parallel'),
      v.literal('orchestrator-worker'),
      v.literal('evaluator-optimizer'),
      v.literal('multi-step-tool')
    ),
    modelConfig: v.object({
      modelType: v.string(),
      parameters: v.object({
        temperature: v.number(),
        topP: v.optional(v.number()),
        maxTokens: v.number(),
        presencePenalty: v.optional(v.number()),
        frequencyPenalty: v.optional(v.number()),
        systemPrompt: v.optional(v.string()),
        stopSequences: v.optional(v.array(v.string()))
      }),
      tokenLimit: v.optional(v.number()),
      costLimit: v.optional(v.number()),
      rateLimiting: v.object({
        requestsPerMinute: v.optional(v.number()),
        tokensPerMinute: v.optional(v.number()),
        concurrentRequests: v.number()
      })
    }),
    memoryConfig: v.object({
      contextWindow: v.number(),
      memoryPersistence: v.boolean(),
      memoryTypes: v.object({
        shortTerm: v.object({
          enabled: v.boolean(),
          maxSize: v.number(),
          retention: v.union(v.literal('session'), v.literal('task'), v.literal('permanent'))
        }),
        working: v.object({
          enabled: v.boolean(),
          maxSize: v.number(),
          retention: v.union(v.literal('session'), v.literal('task'), v.literal('permanent'))
        }),
        episodic: v.object({
          enabled: v.boolean(),
          maxSize: v.number(),
          retention: v.union(v.literal('session'), v.literal('task'), v.literal('permanent'))
        }),
        semantic: v.object({
          enabled: v.boolean(),
          maxSize: v.number(),
          retention: v.union(v.literal('session'), v.literal('task'), v.literal('permanent'))
        }),
        procedural: v.object({
          enabled: v.boolean(),
          maxSize: v.number(),
          retention: v.union(v.literal('session'), v.literal('task'), v.literal('permanent'))
        })
      }),
      sharingProtocols: v.array(v.union(
        v.literal('private'),
        v.literal('team_shared'),
        v.literal('hierarchical'),
        v.literal('global_shared'),
        v.literal('selective')
      )),
      contextInjection: v.object({
        strategy: v.union(
          v.literal('append'),
          v.literal('prepend'),
          v.literal('structured'),
          v.literal('summarized'),
          v.literal('relevant_only')
        ),
        maxContextSize: v.number(),
        relevanceThreshold: v.number(),
        compressionRatio: v.number()
      }),
      persistence: v.object({
        enableVectorStorage: v.boolean(),
        enableSemanticSearch: v.boolean(),
        indexingStrategy: v.union(v.literal('immediate'), v.literal('batch'), v.literal('scheduled')),
        retentionPolicy: v.object({
          shortTerm: v.number(),
          working: v.number(),
          episodic: v.number(),
          semantic: v.number(),
          procedural: v.number()
        })
      })
    }),
    capabilities: v.array(v.string()),
    customCapabilities: v.optional(v.array(v.string())),
    metadata: v.optional(v.record(v.string(), v.any()))
  },
  handler: async (ctx, args) => {
    // Verify project exists
    const project = await ctx.db.get(args.projectId)
    if (!project) {
      throw new Error('Project not found')
    }
    
    const agentId = await ctx.db.insert('agents', {
      projectId: args.projectId,
      name: args.name,
      description: args.description,
      role: args.role,
      protocol: args.protocol,
      workflowPattern: args.workflowPattern,
      status: 'created',
      modelConfig: args.modelConfig,
      memoryConfig: args.memoryConfig,
      capabilities: args.capabilities || args.customCapabilities || [],
      performance: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0,
        totalTokensUsed: 0,
        totalCostIncurred: 0
      },
      createdBy: 'system', // TODO: Get from auth context
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastActiveAt: Date.now(),
      metadata: args.metadata || {}
    })
    
    return agentId
  }
})

// Get all agents
export const list = query({
  args: {
    projectId: v.optional(v.id('projects')),
    status: v.optional(v.union(
      v.literal('created'),
      v.literal('configuring'),
      v.literal('ready'),
      v.literal('active'),
      v.literal('paused'),
      v.literal('error'),
      v.literal('archived')
    )),
    role: v.optional(v.union(v.literal('planner'), v.literal('director'), v.literal('coordinator'), v.literal('expert'), v.literal('builder'))),
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    let agents
    
    if (args.projectId) {
      agents = await ctx.db
        .query('agents')
        .withIndex('by_project', q => q.eq('projectId', args.projectId!))
        .order('desc')
        .collect()
    } else {
      agents = await ctx.db
        .query('agents')
        .order('desc')
        .collect()
    }
    
    // Apply additional filters
    if (args.status) {
      agents = agents.filter(agent => agent.status === args.status)
    }
    
    if (args.role) {
      agents = agents.filter(agent => agent.role === args.role)
    }
    
    // Apply limit
    if (args.limit) {
      agents = agents.slice(0, args.limit)
    }
    
    return agents
  }
})

// Get agent by ID
export const getById = query({
  args: { id: v.id('agents') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  }
})

// Update agent configuration
export const update = mutation({
  args: {
    id: v.id('agents'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.optional(v.union(
      v.literal('created'),
      v.literal('configuring'),
      v.literal('ready'),
      v.literal('active'),
      v.literal('paused'),
      v.literal('error'),
      v.literal('archived')
    )),
    protocol: v.optional(v.string()),
    workflowPattern: v.optional(v.union(
      v.literal('sequential'),
      v.literal('routing'),
      v.literal('parallel'),
      v.literal('orchestrator-worker'),
      v.literal('evaluator-optimizer'),
      v.literal('multi-step-tool')
    )),
    modelConfig: v.optional(v.object({
      modelType: v.optional(v.string()),
      parameters: v.optional(v.object({
        temperature: v.optional(v.number()),
        topP: v.optional(v.number()),
        maxTokens: v.optional(v.number()),
        presencePenalty: v.optional(v.number()),
        frequencyPenalty: v.optional(v.number()),
        systemPrompt: v.optional(v.string()),
        stopSequences: v.optional(v.array(v.string()))
      })),
      tokenLimit: v.optional(v.number()),
      costLimit: v.optional(v.number()),
      rateLimiting: v.optional(v.object({
        requestsPerMinute: v.optional(v.number()),
        tokensPerMinute: v.optional(v.number()),
        concurrentRequests: v.optional(v.number())
      }))
    })),
    capabilities: v.optional(v.array(v.string())),
    customCapabilities: v.optional(v.array(v.string())),
    metadata: v.optional(v.record(v.string(), v.any()))
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args
    const agent = await ctx.db.get(id)
    
    if (!agent) {
      throw new Error('Agent not found')
    }
    
    // Merge nested objects properly
    const patchData: any = {
      ...updates,
      updatedAt: Date.now()
    }
    
    if (updates.modelConfig) {
      patchData.modelConfig = {
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
    
    await ctx.db.patch(id, patchData)
    return id
  }
})

// Delete agent
export const remove = mutation({
  args: { id: v.id('agents') },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id)
    if (!agent) {
      throw new Error('Agent not found')
    }
    
    // Check if agent is currently executing
    if (agent.status === 'active') {
      throw new Error('Cannot delete active agent')
    }
    
    // Check if agent has running executions
    const runningExecutions = await ctx.db
      .query('executions')
      .filter(q => 
        q.and(
          q.eq(q.field('agentId'), args.id),
          q.eq(q.field('status'), 'running')
        )
      )
      .collect()
    
    if (runningExecutions.length > 0) {
      throw new Error('Cannot delete agent with running executions')
    }
    
    await ctx.db.delete(args.id)
    return true
  }
})

// Get agent performance metrics
export const getPerformanceMetrics = query({
  args: {
    id: v.id('agents'),
    timeRange: v.optional(v.number()) // Time range in milliseconds
  },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id)
    if (!agent) {
      throw new Error('Agent not found')
    }
    
    const timeThreshold = args.timeRange ? Date.now() - args.timeRange : 0
    
    // Get executions
    const executions = await ctx.db
      .query('executions')
      .filter(q => 
        q.and(
          q.eq(q.field('agentId'), args.id),
          q.gte(q.field('createdAt'), timeThreshold)
        )
      )
      .collect()
    
    // Get performance data
    const performanceMetrics = await ctx.db
      .query('performanceMetrics')
      .filter(q => 
        q.and(
          q.eq(q.field('entityId'), args.id),
          q.gte(q.field('timestamp'), timeThreshold)
        )
      )
      .collect()
    
    // Get token usage
    const tokenUsage = await ctx.db
      .query('tokenUsage')
      .filter(q => 
        q.and(
          q.eq(q.field('agentId'), args.id),
          q.gte(q.field('timestamp'), timeThreshold)
        )
      )
      .collect()
    
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
      performanceScore: agent.performance?.avgExecutionTime ? 
        Math.max(0, 100 - (avgExecutionTime - agent.performance.avgExecutionTime) / 1000) : 85
    }
  }
})

// Update agent performance
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
    const agent = await ctx.db.get(args.id)
    if (!agent) {
      throw new Error('Agent not found')
    }
    
    const performance = agent.performance
    const updates: any = {
      updatedAt: Date.now(),
      lastActiveAt: Date.now()
    }
    
    if (args.executionDelta) {
      const newTotal = (agent.performance?.totalExecutions || 0) + args.executionDelta.total
      const newSuccessful = (agent.performance?.successfulExecutions || 0) + args.executionDelta.successful
      const newFailed = (agent.performance?.failedExecutions || 0) + args.executionDelta.failed
      
      // Calculate new average execution time
      const currentTotalTime = (agent.performance?.avgExecutionTime || 0) * (agent.performance?.totalExecutions || 0)
      const newTotalTime = currentTotalTime + (args.executionDelta.executionTime || 0)
      const newAvgTime = newTotal > 0 ? newTotalTime / newTotal : 0
      
      updates.performance = {
        ...performance,
        totalExecutions: newTotal,
        successfulExecutions: newSuccessful,
        failedExecutions: newFailed,
        avgExecutionTime: newAvgTime
      }
    }
    
    if (args.resourceDelta) {
      if (!updates.performance) {
        updates.performance = performance
      }
      updates.performance.totalTokensUsed += args.resourceDelta.tokens
      updates.performance.totalCostIncurred += args.resourceDelta.cost
    }
    
    await ctx.db.patch(args.id, updates)
    return args.id
  }
})

// Activate agent
export const activate = mutation({
  args: { id: v.id('agents') },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id)
    if (!agent) {
      throw new Error('Agent not found')
    }
    
    if (agent.status !== 'ready' && agent.status !== 'paused') {
      throw new Error('Agent must be in ready or paused status to activate')
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
  args: { id: v.id('agents') },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id)
    if (!agent) {
      throw new Error('Agent not found')
    }
    
    if (agent.status !== 'active') {
      throw new Error('Agent must be active to deactivate')
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
  args: { id: v.id('agents') },
  handler: async (ctx, args) => {
    const agent = await ctx.db.get(args.id)
    if (!agent) {
      throw new Error('Agent not found')
    }
    
    const issues = []
    
    // Validate model configuration
    if (!agent.modelConfig.modelType) {
      issues.push('Model type is required')
    }
    
    if (agent.modelConfig.parameters.maxTokens <= 0) {
      issues.push('Max tokens must be positive')
    }
    
    if (agent.modelConfig.parameters.temperature < 0 || agent.modelConfig.parameters.temperature > 1) {
      issues.push('Temperature must be between 0 and 1')
    }
    
    // Validate memory configuration
    const totalMemorySize = agent.memoryConfig?.contextWindow || 0
    
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
    projectId: v.optional(v.id('projects'))
  },
  handler: async (ctx, args) => {
    const sourceAgent = await ctx.db.get(args.id)
    if (!sourceAgent) {
      throw new Error('Source agent not found')
    }
    
    const targetProjectId = args.projectId || sourceAgent.projectId
    
    // Verify target project exists
    const targetProject = await ctx.db.get(targetProjectId!)
    if (!targetProject) {
      throw new Error('Target project not found')
    }
    
    // Clone the agent
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
        totalCostIncurred: 0
      },
      createdBy: sourceAgent.createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastActiveAt: Date.now(),
      metadata: {
        ...(sourceAgent.metadata || {}),
        clonedFrom: args.id,
        clonedAt: Date.now()
      }
    })
    
    return clonedAgentId
  }
})