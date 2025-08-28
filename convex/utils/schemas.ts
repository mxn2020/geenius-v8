// convex/utils/schemas.ts - Reusable schema components and validators
import { v } from 'convex/values'

// Base field sets
export const timestampFields = {
  createdAt: v.number(),
  updatedAt: v.number()
}

export const authorshipFields = {
  createdBy: v.string(), // authUserId
  ...timestampFields
}

export const metadataField = {
  metadata: v.optional(v.record(v.string(), v.any()))
}

// Status schemas
export const statusSchemas = {
  agent: v.union(
    v.literal('created'),
    v.literal('configuring'),
    v.literal('ready'),
    v.literal('active'),
    v.literal('paused'),
    v.literal('error'),
    v.literal('archived')
  ),
  execution: v.union(
    v.literal('pending'),
    v.literal('running'),
    v.literal('completed'),
    v.literal('failed'),
    v.literal('cancelled'),
    v.literal('timeout')
  ),
  project: v.union(
    v.literal('active'),
    v.literal('paused'),
    v.literal('completed'),
    v.literal('archived')
  )
}

// Role and pattern schemas
export const roleSchema = v.union(
  v.literal('planner'),
  v.literal('director'),
  v.literal('coordinator'),
  v.literal('expert'),
  v.literal('builder')
)

export const workflowPatternSchema = v.union(
  v.literal('sequential'),
  v.literal('routing'),
  v.literal('parallel'),
  v.literal('orchestrator-worker'),
  v.literal('evaluator-optimizer'),
  v.literal('multi-step-tool')
)

export const prioritySchema = v.union(
  v.literal('low'),
  v.literal('normal'),
  v.literal('high'),
  v.literal('urgent')
)

// Model configuration schema
export const modelConfigSchema = v.object({
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
})

// Memory configuration schema
export const memoryConfigSchema = v.object({
  contextWindow: v.number(),
  memoryPersistence: v.boolean(),
  memoryTypes: v.record(v.string(), v.object({
    enabled: v.boolean(),
    maxSize: v.number(),
    retention: v.union(
      v.literal('session'),
      v.literal('task'),
      v.literal('permanent')
    )
  })),
  sharingProtocols: v.array(v.union(
    v.literal('private'),
    v.literal('team_shared'),
    v.literal('hierarchical'),
    v.literal('global_shared'),
    v.literal('selective')
  ))
})

// Performance tracking schema
export const performanceSchema = v.object({
  totalExecutions: v.number(),
  successfulExecutions: v.number(),
  failedExecutions: v.number(),
  avgExecutionTime: v.number(),
  totalTokensUsed: v.number(),
  totalCostIncurred: v.number(),
  memoryPeak: v.optional(v.number()),
  executionTime: v.optional(v.number()),
  recentSuccessRate: v.optional(v.number()),
  recentAvgExecutionTime: v.optional(v.number())
})

// Progress tracking schema
export const progressSchema = v.object({
  currentStep: v.optional(v.number()),
  totalSteps: v.optional(v.number()),
  percentage: v.optional(v.number()),
  completedSteps: v.optional(v.array(v.string())),
  failedSteps: v.optional(v.array(v.string())),
  activeSteps: v.optional(v.array(v.string()))
})

// Error schema
export const errorSchema = v.object({
  name: v.string(),
  message: v.string(),
  stack: v.optional(v.string()),
  code: v.optional(v.string()),
  stepId: v.optional(v.string())
})

// Common argument schemas
export const paginationArgs = {
  limit: v.optional(v.number()),
  offset: v.optional(v.number())
}

export const cursorPaginationArgs = {
  limit: v.optional(v.number()),
  cursor: v.optional(v.string())
}

export const filterArgs = {
  status: v.optional(v.string()),
  role: v.optional(v.string()),
  createdBy: v.optional(v.string()),
  dateRange: v.optional(v.object({
    start: v.number(),
    end: v.number()
  }))
}

// ID reference schemas
export const idRefs = {
  projectId: v.id('projects'),
  agentId: v.id('agents'),
  executionId: v.id('executions'),
  userId: v.id('users')
}

// Workflow definition schema
export const workflowDefinitionSchema = v.object({
  name: v.string(),
  pattern: workflowPatternSchema,
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
    role: roleSchema,
    config: v.record(v.string(), v.any()),
    dependencies: v.array(v.string())
  }))
})

// Configuration schemas
export const projectConfigSchema = v.object({
  defaultTimeout: v.number(),
  maxConcurrentExecutions: v.number(),
  errorHandling: v.union(
    v.literal('fail-fast'),
    v.literal('continue'),
    v.literal('retry-all')
  )
})

export const resourceLimitsSchema = v.object({
  maxTokensPerExecution: v.number(),
  maxCostPerExecution: v.number(),
  maxExecutionTime: v.number()
})

export const statisticsSchema = v.object({
  totalExecutions: v.number(),
  successfulExecutions: v.number(),
  failedExecutions: v.number(),
  totalTokensUsed: v.number(),
  totalCostIncurred: v.number()
})