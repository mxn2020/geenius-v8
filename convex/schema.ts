// convex/schema.ts - Clean modular schema without legacy code
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { 
  authorshipFields, 
  metadataField, 
  statusSchemas,
  roleSchema,
  workflowPatternSchema,
  prioritySchema,
  modelConfigSchema,
  memoryConfigSchema,
  performanceSchema,
  progressSchema,
  errorSchema,
  workflowDefinitionSchema,
  projectConfigSchema,
  resourceLimitsSchema,
  statisticsSchema
} from './utils/schemas'

const schema = defineSchema({
  // Core user management
  users: defineTable({
    authUserId: v.string(), // Vercel Auth user ID
    email: v.string(),
    name: v.optional(v.string()),
    avatar: v.optional(v.string()),
    preferences: v.optional(v.object({
      theme: v.optional(v.string()), // "light", "dark", "auto"
      notifications: v.optional(v.boolean()),
      language: v.optional(v.string()),
    })),
    createdBy: v.optional(v.string()), // Optional since users create themselves
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index('authUserId', ['authUserId'])
    .index('email', ['email'])
    .index('created', ['createdAt']),

  // Project management
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    status: statusSchemas.project,
    configuration: v.optional(projectConfigSchema),
    resourceLimits: v.optional(resourceLimitsSchema),
    statistics: v.optional(statisticsSchema),
    ...authorshipFields,
    ...metadataField
  })
    .index('createdBy', ['createdBy'])
    .index('status', ['status'])
    .index('created', ['createdAt'])
    .index('updated', ['updatedAt']),

  // AI Agent definitions
  agents: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    projectId: v.id('projects'),
    status: statusSchemas.agent,
    role: roleSchema,
    protocol: v.string(),
    workflowPattern: workflowPatternSchema,
    modelConfig: modelConfigSchema,
    memoryConfig: memoryConfigSchema,
    capabilities: v.array(v.string()),
    performance: performanceSchema,
    lastActiveAt: v.number(),
    ...authorshipFields,
    ...metadataField
  })
    .index('by_project', ['projectId'])
    .index('by_status', ['status'])
    .index('by_role', ['role'])
    .index('by_pattern', ['workflowPattern'])
    .index('created', ['createdAt'])
    .index('last_active', ['lastActiveAt'])
    .index('project_status', ['projectId', 'status']),

  // Execution tracking
  executions: defineTable({
    projectId: v.id('projects'),
    agentId: v.optional(v.id('agents')),
    status: statusSchemas.execution,
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
    priority: prioritySchema,
    progress: progressSchema,
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
    performance: performanceSchema,
    error: v.optional(errorSchema),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    ...authorshipFields,
    ...metadataField
  })
    .index('by_project', ['projectId'])
    .index('by_agent', ['agentId'])
    .index('by_status', ['status'])
    .index('by_priority', ['priority'])
    .index('created', ['createdAt'])
    .index('started', ['startedAt'])
    .index('completed', ['completedAt'])
    .index('project_status', ['projectId', 'status'])
    .index('project_created', ['projectId', 'createdAt']),

  // Agent activity logging
  agentActivities: defineTable({
    agentId: v.id('agents'),
    executionId: v.optional(v.id('executions')),
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
      cost: v.optional(v.number())
    })),
    timestamp: v.number(),
    ...metadataField
  })
    .index('by_agent', ['agentId'])
    .index('by_execution', ['executionId'])
    .index('by_type', ['activityType'])
    .index('by_timestamp', ['timestamp'])
    .index('agent_execution', ['agentId', 'executionId'])
    .index('agent_timestamp', ['agentId', 'timestamp']),

  // Performance metrics
  performanceMetrics: defineTable({
    entityType: v.union(
      v.literal('agent'), 
      v.literal('execution'), 
      v.literal('project')
    ),
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
    periodStart: v.optional(v.number()),
    periodEnd: v.optional(v.number()),
    timestamp: v.number(),
    ...metadataField
  })
    .index('by_entity', ['entityType', 'entityId'])
    .index('by_metric', ['metricType'])
    .index('by_timestamp', ['timestamp'])
    .index('entity_metric', ['entityType', 'entityId', 'metricType'])
    .index('execution_id', ['executionId']),

  // Token usage tracking
  tokenUsage: defineTable({
    agentId: v.id('agents'),
    executionId: v.optional(v.id('executions')),
    projectId: v.id('projects'),
    modelType: v.string(),
    promptTokens: v.number(),
    responseTokens: v.number(),
    totalTokens: v.number(),
    cost: v.optional(v.number()),
    requestType: v.optional(v.string()),
    timestamp: v.number()
  })
    .index('by_agent', ['agentId'])
    .index('by_execution', ['executionId'])
    .index('by_project', ['projectId'])
    .index('by_model', ['modelType'])
    .index('by_timestamp', ['timestamp'])
    .index('agent_timestamp', ['agentId', 'timestamp'])
    .index('project_timestamp', ['projectId', 'timestamp']),

  // Audit logging
  auditLogs: defineTable({
    entityType: v.union(
      v.literal('project'),
      v.literal('agent'),
      v.literal('execution'),
      v.literal('user')
    ),
    entityId: v.string(),
    executionId: v.optional(v.string()),
    action: v.union(
      v.literal('created'),
      v.literal('updated'),
      v.literal('deleted'),
      v.literal('activated'),
      v.literal('deactivated'),
      v.literal('executed'),
      v.literal('paused'),
      v.literal('resumed'),
      v.literal('cancelled')
    ),
    changes: v.optional(v.object({
      before: v.optional(v.any()),
      after: v.optional(v.any()),
      fieldsChanged: v.optional(v.array(v.string()))
    })),
    performedBy: v.string(), // authUserId
    reason: v.optional(v.string()),
    severity: v.union(
      v.literal('low'), 
      v.literal('medium'), 
      v.literal('high'), 
      v.literal('critical')
    ),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    timestamp: v.number()
  })
    .index('by_entity', ['entityType', 'entityId'])
    .index('by_action', ['action'])
    .index('by_performer', ['performedBy'])
    .index('by_timestamp', ['timestamp'])
    .index('by_severity', ['severity'])
    .index('entity_timestamp', ['entityType', 'entityId', 'timestamp'])
    .index('execution_id', ['executionId']),
})

export default schema

// Export types for use in other files
export type { 
  Doc, 
  Id 
} from './_generated/dataModel'