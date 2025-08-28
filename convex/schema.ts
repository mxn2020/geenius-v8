// convex/schema.ts

import { defineSchema, defineTable } from 'convex/server'
import { type Infer, v } from 'convex/values'

const schema = defineSchema({
  users: defineTable({
    authUserId: v.string(), // Reference to Better Auth user ID
    email: v.string(),
    name: v.optional(v.string()),
    avatar: v.optional(v.string()),
    karmaLevel: v.number(),
    tasksCompleted: v.number(),
    tasksAssigned: v.number(),
    preferences: v.optional(v.object({
      theme: v.optional(v.string()), // "light", "dark", "auto"
      notifications: v.optional(v.boolean()),
      language: v.optional(v.string()),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('authUserId', ['authUserId'])
    .index('email', ['email']),

  // Core Geenius entities
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    status: v.union(v.literal('active'), v.literal('paused'), v.literal('completed'), v.literal('archived')),
    config: v.optional(v.object({
      defaultModelConfig: v.optional(v.object({
        modelType: v.string(),
        parameters: v.optional(v.any()),
        tokenLimit: v.optional(v.number()),
        costLimit: v.optional(v.number()),
      })),
      templates: v.optional(v.array(v.string())),
      settings: v.optional(v.any()),
    })),
    configuration: v.optional(v.object({
      defaultTimeout: v.number(),
      maxConcurrentExecutions: v.number(),
      errorHandling: v.union(v.literal('fail-fast'), v.literal('continue'), v.literal('retry-all')),
    })),
    resourceLimits: v.optional(v.object({
      maxTokensPerExecution: v.number(),
      maxCostPerExecution: v.number(),
      maxExecutionTime: v.number(),
    })),
    statistics: v.optional(v.object({
      totalExecutions: v.number(),
      successfulExecutions: v.number(),
      failedExecutions: v.number(),
      totalTokensUsed: v.number(),
      totalCostIncurred: v.number(),
    })),
    createdBy: v.string(), // authUserId
    createdAt: v.number(),
    updatedAt: v.number(),
    metadata: v.optional(v.record(v.string(), v.any())),
  })
    .index('createdBy', ['createdBy'])
    .index('status', ['status'])
    .index('created', ['createdAt']),

  agents: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
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
    role: v.union(
      v.literal('planner'),
      v.literal('director'), 
      v.literal('coordinator'),
      v.literal('expert'),
      v.literal('builder')
    ),
    protocol: v.string(), // Processing methodology per role type
    workflowPattern: v.union(
      v.literal('sequential'),
      v.literal('routing'),
      v.literal('parallel'),
      v.literal('orchestrator-worker'),
      v.literal('evaluator-optimizer'),
      v.literal('multi-step-tool')
    ),
    modelConfig: v.object({
      modelType: v.string(), // "gpt-4", "claude-3-5-sonnet", etc.
      parameters: v.optional(v.any()),
      tokenLimit: v.optional(v.number()),
      costLimit: v.optional(v.number()),
      rateLimiting: v.optional(v.object({
        requestsPerMinute: v.optional(v.number()),
        tokensPerMinute: v.optional(v.number()),
        concurrentRequests: v.optional(v.number()),
      })),
    }),
    memoryConfig: v.optional(v.object({
      contextWindow: v.optional(v.number()),
      memoryPersistence: v.optional(v.boolean()),
      sharingProtocols: v.optional(v.array(v.string())),
    })),
    capabilities: v.optional(v.array(v.string())),
    resourceRequirements: v.optional(v.object({
      minTokens: v.optional(v.number()),
      maxTokens: v.optional(v.number()),
      estimatedCost: v.optional(v.number()),
    })),
    performance: v.optional(v.object({
      totalExecutions: v.number(),
      successfulExecutions: v.number(),
      failedExecutions: v.number(),
      avgExecutionTime: v.number(),
      totalTokensUsed: v.optional(v.number()),
      totalCostIncurred: v.optional(v.number())
    })),
    lastActiveAt: v.optional(v.number()),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdBy: v.string(), // authUserId
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('createdBy', ['createdBy'])
    .index('role', ['role'])
    .index('workflowPattern', ['workflowPattern'])
    .index('created', ['createdAt'])
    .index('by_project', ['projectId'])
    .index('status', ['status']),

  agentStructures: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    hierarchyDefinition: v.object({
      rootAgentId: v.id('agents'),
      relationships: v.array(v.object({
        parentAgentId: v.id('agents'),
        childAgentId: v.id('agents'),
        relationshipType: v.union(
          v.literal('reports_to'),
          v.literal('coordinates_with'),
          v.literal('delegates_to')
        ),
      })),
    }),
    coordinationRules: v.array(v.object({
      sourceAgentId: v.id('agents'),
      targetAgentId: v.id('agents'),
      communicationProtocol: v.string(),
      escalationRules: v.optional(v.array(v.string())),
    })),
    createdBy: v.string(), // authUserId
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('createdBy', ['createdBy'])
    .index('rootAgent', ['hierarchyDefinition.rootAgentId'])
    .index('created', ['createdAt']),

  workflows: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    projectId: v.id('projects'),
    tasks: v.array(v.object({
      id: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      taskType: v.string(),
      inputs: v.optional(v.any()),
      outputs: v.optional(v.any()),
      constraints: v.optional(v.any()),
      priority: v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('critical')),
      estimatedDuration: v.optional(v.number()),
      resourceRequirements: v.optional(v.any()),
    })),
    dependencies: v.array(v.object({
      taskId: v.string(),
      dependsOnTaskId: v.string(),
      dependencyType: v.union(v.literal('finish_to_start'), v.literal('start_to_start'), v.literal('finish_to_finish')),
    })),
    executionConfig: v.optional(v.object({
      maxRetries: v.optional(v.number()),
      timeout: v.optional(v.number()),
      errorHandling: v.optional(v.string()),
      scheduleConfig: v.optional(v.any()),
    })),
    createdBy: v.string(), // authUserId
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('project', ['projectId'])
    .index('createdBy', ['createdBy'])
    .index('created', ['createdAt']),

  executions: defineTable({
    projectId: v.id('projects'),
    workflowId: v.optional(v.id('workflows')),
    agentId: v.optional(v.id('agents')),
    agentStructureId: v.optional(v.id('agentStructures')),
    status: v.union(
      v.literal('pending'),
      v.literal('running'),
      v.literal('paused'),
      v.literal('completed'),
      v.literal('failed'),
      v.literal('cancelled')
    ),
    workflowDefinition: v.optional(v.object({
      name: v.string(),
      pattern: v.string(),
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
        role: v.string(),
        config: v.record(v.string(), v.any()),
        dependencies: v.array(v.string())
      }))
    })),
    input: v.optional(v.record(v.string(), v.any())),
    configuration: v.optional(v.object({
      timeout: v.optional(v.number()),
      maxConcurrency: v.optional(v.number()),
      errorHandling: v.optional(v.string()),
      saveIntermediateResults: v.optional(v.boolean())
    })),
    priority: v.optional(v.string()),
    progress: v.optional(v.object({
      currentTaskId: v.optional(v.string()),
      currentStep: v.optional(v.number()),
      totalSteps: v.optional(v.number()),
      percentage: v.optional(v.number()),
      completedTasks: v.optional(v.array(v.string())),
      completedSteps: v.optional(v.array(v.string())),
      failedSteps: v.optional(v.array(v.string())),
      activeSteps: v.optional(v.array(v.string()))
    })),
    results: v.optional(v.object({
      stepResults: v.optional(v.record(v.string(), v.any())),
      intermediateOutputs: v.optional(v.array(v.object({
        stepId: v.string(),
        timestamp: v.number(),
        output: v.any(),
        metadata: v.record(v.string(), v.any())
      }))),
      finalResult: v.optional(v.any())
    })),
    error: v.optional(v.string()),
    startTime: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    endTime: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    estimatedCompletion: v.optional(v.number()),
    performance: v.optional(v.object({
      totalTokensUsed: v.number(),
      totalCostIncurred: v.number(),
      executionTime: v.number(),
      memoryPeak: v.optional(v.number()),
      cpuUsage: v.optional(v.number())
    })),
    metadata: v.optional(v.record(v.string(), v.any())),
    createdBy: v.string(), // authUserId
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('project', ['projectId'])
    .index('workflow', ['workflowId'])
    .index('agent', ['agentId'])
    .index('status', ['status'])
    .index('createdBy', ['createdBy'])
    .index('startTime', ['startTime'])
    .index('created', ['createdAt'])
    .index('by_project', ['projectId']),

  // Lifecycle tracking and monitoring tables
  agentActivities: defineTable({
    agentId: v.id('agents'),
    executionId: v.id('executions'),
    activityType: v.union(
      v.literal('prompt_sent'),
      v.literal('response_received'),
      v.literal('task_started'),
      v.literal('task_completed'),
      v.literal('error_occurred'),
      v.literal('coordination_message')
    ),
    prompt: v.optional(v.string()),
    response: v.optional(v.string()),
    tokenUsage: v.optional(v.object({
      promptTokens: v.number(),
      responseTokens: v.number(),
      totalTokens: v.number(),
      cost: v.optional(v.number()),
    })),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
  })
    .index('agent', ['agentId'])
    .index('execution', ['executionId'])
    .index('activityType', ['activityType'])
    .index('timestamp', ['timestamp'])
    .index('agent_execution', ['agentId', 'executionId']),

  performanceMetrics: defineTable({
    entityType: v.union(v.literal('agent'), v.literal('execution'), v.literal('workflow'), v.literal('project')),
    entityId: v.string(),
    executionId: v.optional(v.string()),
    metricType: v.union(
      v.literal('execution_time'),
      v.literal('success_rate'),
      v.literal('token_usage'),
      v.literal('cost'),
      v.literal('error_rate'),
      v.literal('throughput')
    ),
    value: v.number(),
    unit: v.optional(v.string()),
    metadata: v.optional(v.any()),
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    timestamp: v.number(),
  })
    .index('entity', ['entityType', 'entityId'])
    .index('metricType', ['metricType'])
    .index('timestamp', ['timestamp'])
    .index('entity_metric', ['entityType', 'entityId', 'metricType'])
    .index('executionId', ['executionId']),

  tokenUsage: defineTable({
    agentId: v.id('agents'),
    executionId: v.optional(v.id('executions')),
    projectId: v.optional(v.id('projects')),
    modelType: v.string(),
    promptTokens: v.number(),
    responseTokens: v.number(),
    totalTokens: v.number(),
    cost: v.optional(v.number()),
    requestType: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index('agent', ['agentId'])
    .index('execution', ['executionId'])
    .index('project', ['projectId'])
    .index('modelType', ['modelType'])
    .index('timestamp', ['timestamp'])
    .index('agent_timestamp', ['agentId', 'timestamp'])
    .index('by_project', ['projectId']),

  // Audit tables for system changes and configurations
  auditLogs: defineTable({
    entityType: v.union(
      v.literal('project'),
      v.literal('agent'),
      v.literal('agentStructure'),
      v.literal('workflow'),
      v.literal('execution'),
      v.literal('user')
    ),
    entityId: v.string(),
    executionId: v.optional(v.string()), // For execution-related audit logs
    action: v.union(
      v.literal('created'),
      v.literal('updated'),
      v.literal('deleted'),
      v.literal('assigned'),
      v.literal('unassigned'),
      v.literal('executed'),
      v.literal('paused'),
      v.literal('resumed'),
      v.literal('cancelled')
    ),
    changes: v.optional(v.object({
      before: v.optional(v.any()),
      after: v.optional(v.any()),
      fieldsChanged: v.optional(v.array(v.string())),
    })),
    performedBy: v.string(), // authUserId
    reason: v.optional(v.string()),
    severity: v.optional(v.union(v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('critical'))),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index('entity', ['entityType', 'entityId'])
    .index('action', ['action'])
    .index('performedBy', ['performedBy'])
    .index('timestamp', ['timestamp'])
    .index('entity_timestamp', ['entityType', 'entityId', 'timestamp'])
    .index('by_execution', ['executionId']),

  configurationHistory: defineTable({
    entityType: v.union(v.literal('project'), v.literal('agent'), v.literal('agentStructure'), v.literal('workflow')),
    entityId: v.string(),
    version: v.number(),
    configuration: v.any(),
    changeDescription: v.optional(v.string()),
    isActive: v.boolean(),
    createdBy: v.string(), // authUserId
    createdAt: v.number(),
  })
    .index('entity', ['entityType', 'entityId'])
    .index('version', ['entityType', 'entityId', 'version'])
    .index('active', ['entityType', 'entityId', 'isActive'])
    .index('createdBy', ['createdBy'])
    .index('created', ['createdAt']),

  // Legacy Kanban entities (keeping for backwards compatibility)
  boards: defineTable({
    id: v.string(),
    name: v.string(),
    color: v.string(),
    createdBy: v.optional(v.string()), // authUserId of creator
    createdAt: v.optional(v.number()),
  }).index('id', ['id'])
    .index('createdBy', ['createdBy']),

  columns: defineTable({
    id: v.string(),
    boardId: v.string(),
    name: v.string(),
    order: v.number(),
  })
    .index('id', ['id'])
    .index('board', ['boardId']),

  items: defineTable({
    id: v.string(),
    title: v.string(),
    content: v.optional(v.string()),
    order: v.number(),
    columnId: v.string(),
    boardId: v.string(),
  })
    .index('id', ['id'])
    .index('column', ['columnId'])
    .index('board', ['boardId']),

  notifications: defineTable({
    id: v.string(),
    userId: v.string(), // authUserId of recipient
    type: v.union(v.literal('assignment'), v.literal('completion'), v.literal('invite'), v.literal('achievement'), v.literal('reminder')),
    title: v.string(),
    message: v.string(),
    emoji: v.string(),
    isRead: v.boolean(),
    actionUrl: v.optional(v.string()),
    entityType: v.optional(v.union(v.literal('board'), v.literal('item'), v.literal('user'))),
    entityId: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('id', ['id'])
    .index('user', ['userId'])
    .index('user_read', ['userId', 'isRead'])
    .index('created', ['createdAt']),
})
export default schema

// Schema validators
const user = schema.tables.users.validator
const project = schema.tables.projects.validator
const agent = schema.tables.agents.validator
const agentStructure = schema.tables.agentStructures.validator
const workflow = schema.tables.workflows.validator
const execution = schema.tables.executions.validator
const agentActivity = schema.tables.agentActivities.validator
const performanceMetric = schema.tables.performanceMetrics.validator
const tokenUsage = schema.tables.tokenUsage.validator
const auditLog = schema.tables.auditLogs.validator
const configurationHistory = schema.tables.configurationHistory.validator

// Legacy validators (keeping for backwards compatibility)
const board = schema.tables.boards.validator
const column = schema.tables.columns.validator
const item = schema.tables.items.validator
const notification = schema.tables.notifications.validator

// Legacy update schemas (keeping for backwards compatibility)
export const updateBoardSchema = v.object({
  id: board.fields.id,
  name: v.optional(board.fields.name),
  color: v.optional(v.string()),
})

export const updateColumnSchema = v.object({
  id: column.fields.id,
  boardId: column.fields.boardId,
  name: v.optional(column.fields.name),
  order: v.optional(column.fields.order),
})

export const deleteItemSchema = v.object({
  id: item.fields.id,
  boardId: item.fields.boardId,
})
const { order, id, ...rest } = column.fields
export const newColumnsSchema = v.object(rest)
export const deleteColumnSchema = v.object({
  boardId: column.fields.boardId,
  id: column.fields.id,
})

// Core Geenius types
export type User = Infer<typeof user>
export type Project = Infer<typeof project>
export type Agent = Infer<typeof agent>
export type AgentStructure = Infer<typeof agentStructure>
export type Workflow = Infer<typeof workflow>
export type Execution = Infer<typeof execution>
export type AgentActivity = Infer<typeof agentActivity>
export type PerformanceMetric = Infer<typeof performanceMetric>
export type TokenUsage = Infer<typeof tokenUsage>
export type AuditLog = Infer<typeof auditLog>
export type ConfigurationHistory = Infer<typeof configurationHistory>

// Legacy types (keeping for backwards compatibility)
export type Board = Infer<typeof board>
export type Column = Infer<typeof column>
export type Item = Infer<typeof item>
export type Notification = Infer<typeof notification>
