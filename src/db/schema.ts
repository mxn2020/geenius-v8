// src/db/schema.ts

import { z } from 'zod'

// Zod is necessary for client side parsing.

// Core Geenius entity schemas
export const projectSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  status: z.enum(['active', 'paused', 'completed', 'archived']),
  config: z.object({
    defaultModelConfig: z.object({
      modelType: z.string(),
      parameters: z.any().optional(),
      tokenLimit: z.number().optional(),
      costLimit: z.number().optional(),
    }).optional(),
    templates: z.array(z.string()).optional(),
    settings: z.any().optional(),
  }).optional(),
  createdBy: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const agentSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  role: z.enum(['planner', 'director', 'coordinator', 'expert', 'builder']),
  protocol: z.string(),
  workflowPattern: z.enum([
    'sequential',
    'routing', 
    'parallel',
    'orchestrator-worker',
    'evaluator-optimizer',
    'multi-step-tool'
  ]),
  modelConfig: z.object({
    modelType: z.string(),
    parameters: z.any().optional(),
    tokenLimit: z.number().optional(),
    costLimit: z.number().optional(),
  }),
  memoryConfig: z.object({
    contextWindow: z.number().optional(),
    memoryPersistence: z.boolean().optional(),
    sharingProtocols: z.array(z.string()).optional(),
  }).optional(),
  capabilities: z.array(z.string()).optional(),
  resourceRequirements: z.object({
    minTokens: z.number().optional(),
    maxTokens: z.number().optional(),
    estimatedCost: z.number().optional(),
  }).optional(),
  createdBy: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const agentStructureSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  hierarchyDefinition: z.object({
    rootAgentId: z.string(),
    relationships: z.array(z.object({
      parentAgentId: z.string(),
      childAgentId: z.string(),
      relationshipType: z.enum(['reports_to', 'coordinates_with', 'delegates_to']),
    })),
  }),
  coordinationRules: z.array(z.object({
    sourceAgentId: z.string(),
    targetAgentId: z.string(),
    communicationProtocol: z.string(),
    escalationRules: z.array(z.string()).optional(),
  })),
  createdBy: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const workflowSchema = z.object({
  _id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  projectId: z.string(),
  tasks: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
    taskType: z.string(),
    inputs: z.any().optional(),
    outputs: z.any().optional(),
    constraints: z.any().optional(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    estimatedDuration: z.number().optional(),
    resourceRequirements: z.any().optional(),
  })),
  dependencies: z.array(z.object({
    taskId: z.string(),
    dependsOnTaskId: z.string(),
    dependencyType: z.enum(['finish_to_start', 'start_to_start', 'finish_to_finish']),
  })),
  executionConfig: z.object({
    maxRetries: z.number().optional(),
    timeout: z.number().optional(),
    errorHandling: z.string().optional(),
    scheduleConfig: z.any().optional(),
  }).optional(),
  createdBy: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const executionSchema = z.object({
  _id: z.string(),
  projectId: z.string(),
  workflowId: z.string(),
  agentStructureId: z.string().optional(),
  status: z.enum(['pending', 'running', 'paused', 'completed', 'failed', 'cancelled']),
  progress: z.object({
    currentTaskId: z.string().optional(),
    completedTasks: z.array(z.string()).optional(),
    totalTasks: z.number().optional(),
    progressPercentage: z.number().optional(),
  }).optional(),
  results: z.any().optional(),
  error: z.string().optional(),
  startTime: z.number().optional(),
  endTime: z.number().optional(),
  estimatedCompletion: z.number().optional(),
  createdBy: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

// Lifecycle tracking schemas
export const agentActivitySchema = z.object({
  _id: z.string(),
  agentId: z.string(),
  executionId: z.string(),
  activityType: z.enum([
    'prompt_sent',
    'response_received', 
    'task_started',
    'task_completed',
    'error_occurred',
    'coordination_message'
  ]),
  prompt: z.string().optional(),
  response: z.string().optional(),
  tokenUsage: z.object({
    promptTokens: z.number(),
    responseTokens: z.number(),
    totalTokens: z.number(),
    cost: z.number().optional(),
  }).optional(),
  metadata: z.any().optional(),
  timestamp: z.number(),
})

export const performanceMetricSchema = z.object({
  _id: z.string(),
  entityType: z.enum(['agent', 'execution', 'workflow', 'project']),
  entityId: z.string(),
  metricType: z.enum([
    'execution_time',
    'success_rate',
    'token_usage',
    'cost',
    'error_rate',
    'throughput'
  ]),
  value: z.number(),
  unit: z.string().optional(),
  metadata: z.any().optional(),
  periodStart: z.number().optional(),
  periodEnd: z.number().optional(),
  timestamp: z.number(),
})

export const tokenUsageSchema = z.object({
  _id: z.string(),
  agentId: z.string(),
  executionId: z.string().optional(),
  projectId: z.string().optional(),
  modelType: z.string(),
  promptTokens: z.number(),
  responseTokens: z.number(),
  totalTokens: z.number(),
  cost: z.number().optional(),
  requestType: z.string().optional(),
  timestamp: z.number(),
})

// Audit schemas
export const auditLogSchema = z.object({
  _id: z.string(),
  entityType: z.enum(['project', 'agent', 'agentStructure', 'workflow', 'execution', 'user']),
  entityId: z.string(),
  action: z.enum([
    'created',
    'updated',
    'deleted',
    'assigned',
    'unassigned',
    'executed',
    'paused',
    'resumed',
    'cancelled'
  ]),
  changes: z.object({
    before: z.any().optional(),
    after: z.any().optional(),
    fieldsChanged: z.array(z.string()).optional(),
  }).optional(),
  performedBy: z.string(),
  reason: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  timestamp: z.number(),
})

export const configurationHistorySchema = z.object({
  _id: z.string(),
  entityType: z.enum(['project', 'agent', 'agentStructure', 'workflow']),
  entityId: z.string(),
  version: z.number(),
  configuration: z.any(),
  changeDescription: z.string().optional(),
  isActive: z.boolean(),
  createdBy: z.string(),
  createdAt: z.number(),
})

// Type inference for TypeScript
export type Project = z.infer<typeof projectSchema>
export type Agent = z.infer<typeof agentSchema>
export type AgentStructure = z.infer<typeof agentStructureSchema>
export type Workflow = z.infer<typeof workflowSchema>
export type Execution = z.infer<typeof executionSchema>
export type AgentActivity = z.infer<typeof agentActivitySchema>
export type PerformanceMetric = z.infer<typeof performanceMetricSchema>
export type TokenUsage = z.infer<typeof tokenUsageSchema>
export type AuditLog = z.infer<typeof auditLogSchema>
export type ConfigurationHistory = z.infer<typeof configurationHistorySchema>

// Legacy schemas (keeping for backwards compatibility)
export const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string().optional(),
  order: z.coerce.number(),
  columnId: z.string(),
  boardId: z.coerce.string(),
})

export const deleteItemSchema = itemSchema.pick({ id: true, boardId: true })

