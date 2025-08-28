// src/types/core.ts - Core type definitions aligned with Convex schema

import { type Id, type Doc } from '../../convex/_generated/dataModel'

// ============================================================================
// BASE TYPES
// ============================================================================

// Re-export Convex types for convenience
export type { Id, Doc } from '../../convex/_generated/dataModel'

// Base entity interface for all documents
export interface BaseEntity {
  _id: string
  _creationTime: number
}

// ============================================================================
// USER TYPES
// ============================================================================

export interface ConvexUser extends Doc<'users'> {}

export interface UserPreferences {
  theme?: 'light' | 'dark' | 'auto'
  notifications?: boolean
  language?: string
}

export interface UserStats {
  user: {
    id: Id<'users'>
    name?: string
    email: string
    avatar?: string
    createdAt: number
  }
  stats: {
    projectsCount: number
    agentsCount: number
    executionsCount: number
    completedExecutions: number
    failedExecutions: number
    successRate: number
  }
}

// ============================================================================
// PROJECT TYPES
// ============================================================================

// Project status literals
export const PROJECT_STATUSES = ['active', 'paused', 'completed', 'archived'] as const
export type ProjectStatus = typeof PROJECT_STATUSES[number]

// Project interfaces based on Convex schema
export interface Project extends Doc<'projects'> {}

export interface ProjectConfiguration {
  defaultTimeout: number
  maxConcurrentExecutions: number
  errorHandling: 'fail-fast' | 'continue' | 'retry-all'
}

export interface ProjectResourceLimits {
  maxTokensPerExecution: number
  maxCostPerExecution: number
  maxExecutionTime: number
}

export interface ProjectStatistics {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  totalTokensUsed: number
  totalCostIncurred: number
}

export interface ProjectFilters {
  status?: ProjectStatus
  createdBy?: string
  dateRange?: {
    start: number
    end: number
  }
}

export interface ProjectFormData {
  name: string
  description?: string
  configuration?: ProjectConfiguration
  resourceLimits?: ProjectResourceLimits
  metadata?: Record<string, any>
  createdBy: string
}

// ============================================================================
// AGENT TYPES
// ============================================================================

// Agent status and role literals
export const AGENT_STATUSES = [
  'created', 'configuring', 'ready', 'active', 'paused', 'error', 'archived'
] as const
export type AgentStatus = typeof AGENT_STATUSES[number]

export const AGENT_ROLES = ['planner', 'director', 'coordinator', 'expert', 'builder'] as const
export type AgentRole = typeof AGENT_ROLES[number]

export const WORKFLOW_PATTERNS = [
  'sequential', 'routing', 'parallel', 'orchestrator-worker', 
  'evaluator-optimizer', 'multi-step-tool'
] as const
export type WorkflowPattern = typeof WORKFLOW_PATTERNS[number]

// Agent interfaces
export interface Agent extends Doc<'agents'> {}

export interface ModelConfig {
  modelType: string
  parameters: {
    temperature: number
    topP?: number
    maxTokens: number
    presencePenalty?: number
    frequencyPenalty?: number
    systemPrompt?: string
    stopSequences?: string[]
  }
  tokenLimit?: number
  costLimit?: number
  rateLimiting: {
    requestsPerMinute?: number
    tokensPerMinute?: number
    concurrentRequests: number
  }
}

export interface MemoryConfig {
  contextWindow: number
  memoryPersistence: boolean
  memoryTypes: Record<string, {
    enabled: boolean
    maxSize: number
    retention: 'session' | 'task' | 'permanent'
  }>
  sharingProtocols: Array<'private' | 'team_shared' | 'hierarchical' | 'global_shared' | 'selective'>
}

export interface AgentPerformance {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  avgExecutionTime: number
  totalTokensUsed: number
  totalCostIncurred: number
  memoryPeak?: number
  executionTime?: number
  recentSuccessRate?: number
  recentAvgExecutionTime?: number
}

export interface AgentFilters {
  status?: AgentStatus
  role?: AgentRole
  workflowPattern?: WorkflowPattern
  createdBy?: string
  dateRange?: {
    start: number
    end: number
  }
}

export interface AgentFormData {
  projectId: Id<'projects'>
  name: string
  description?: string
  role: AgentRole
  protocol: string
  workflowPattern: WorkflowPattern
  modelConfig: ModelConfig
  memoryConfig: MemoryConfig
  capabilities: string[]
  metadata?: Record<string, any>
  authUserId?: string
}

// ============================================================================
// EXECUTION TYPES
// ============================================================================

// Execution status and priority literals
export const EXECUTION_STATUSES = [
  'pending', 'running', 'completed', 'failed', 'cancelled', 'timeout'
] as const
export type ExecutionStatus = typeof EXECUTION_STATUSES[number]

export const PRIORITY_LEVELS = ['low', 'normal', 'high', 'urgent'] as const
export type PriorityLevel = typeof PRIORITY_LEVELS[number]

// Execution interfaces
export interface Execution extends Doc<'executions'> {}

export interface WorkflowDefinition {
  name: string
  pattern: WorkflowPattern
  steps: WorkflowStep[]
  agents: WorkflowAgent[]
}

export interface WorkflowStep {
  id: string
  name: string
  agentId: string
  input?: Record<string, any>
  condition?: string
  retry?: {
    maxAttempts: number
    backoffMs: number
  }
}

export interface WorkflowAgent {
  agentId: string
  role: AgentRole
  config: Record<string, any>
  dependencies: string[]
}

export interface ExecutionProgress {
  currentStep?: number
  totalSteps?: number
  percentage?: number
  completedSteps?: string[]
  failedSteps?: string[]
  activeSteps?: string[]
}

export interface ExecutionResults {
  stepResults?: Record<string, any>
  intermediateOutputs?: Array<{
    stepId: string
    timestamp: number
    output: any
    metadata: Record<string, any>
  }>
  finalResult?: any
}

export interface ExecutionError {
  name: string
  message: string
  stack?: string
  code?: string
  stepId?: string
}

export interface ExecutionFilters {
  status?: ExecutionStatus
  priority?: PriorityLevel
  createdBy?: string
  dateRange?: {
    start: number
    end: number
  }
}

export interface ExecutionFormData {
  projectId: Id<'projects'>
  agentId?: Id<'agents'>
  workflowDefinition: WorkflowDefinition
  input?: Record<string, any>
  configuration?: {
    timeout?: number
    maxConcurrency?: number
    errorHandling?: 'fail-fast' | 'continue' | 'retry-all'
    saveIntermediateResults?: boolean
  }
  priority?: PriorityLevel
  metadata?: Record<string, any>
  authUserId?: string
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[]
  hasMore: boolean
  total?: number
}

export interface CursorPaginatedResponse<T> {
  data: T[]
  hasMore: boolean
  nextCursor?: string
}

export interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
  timestamp: number
}

// ============================================================================
// PERFORMANCE & MONITORING TYPES
// ============================================================================

export interface PerformanceMetrics {
  timestamp: number
  entityType: 'agent' | 'execution' | 'project'
  entityId: string
  executionId?: string
  metricType: 'execution_time' | 'success_rate' | 'token_usage' | 'cost' | 'error_rate' | 'throughput'
  value: number
  unit?: string
  periodStart?: number
  periodEnd?: number
}

export interface TokenUsage {
  agentId: Id<'agents'>
  executionId?: Id<'executions'>
  projectId: Id<'projects'>
  modelType: string
  promptTokens: number
  responseTokens: number
  totalTokens: number
  cost?: number
  requestType?: string
  timestamp: number
}

export interface AuditLogEntry {
  entityType: 'project' | 'agent' | 'execution' | 'user'
  entityId: string
  executionId?: string
  action: 'created' | 'updated' | 'deleted' | 'activated' | 'deactivated' | 'executed' | 'paused' | 'resumed' | 'cancelled'
  changes?: {
    before?: any
    after?: any
    fieldsChanged?: string[]
  }
  performedBy: string
  reason?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  ipAddress?: string
  userAgent?: string
  timestamp: number
}

export interface QueueStatus {
  projectId?: Id<'projects'>
  queue: {
    pending: number
    running: number
    completed: number
    failed: number
    cancelled: number
    total: number
  }
  performance: {
    avgWaitTime: number
    avgExecutionTime: number
    throughput: number
  }
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

export type RequireField<T, K extends keyof T> = T & Required<Pick<T, K>>
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// Sort and filter utilities
export type SortField = 'name' | 'created' | 'updated' | 'status' | 'cost' | 'executions'
export type SortOrder = 'asc' | 'desc'
export type ViewMode = 'grid' | 'list'

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

export interface AuthState {
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
  currentView: 'login' | 'register' | 'forgot-password' | 'reset-password' | null
}

// ============================================================================
// NOTIFICATION TYPES (if still needed)
// ============================================================================

export interface Notification {
  id: string
  userId: string
  type: 'assignment' | 'completion' | 'invite' | 'achievement' | 'reminder'
  title: string
  message: string
  emoji: string
  isRead: boolean
  actionUrl?: string
  entityType?: 'board' | 'item' | 'user'
  entityId?: string
  createdAt: number
  updatedAt: number
}

// ============================================================================
// LEGACY TYPES (for backwards compatibility, can be removed later)
// ============================================================================

export interface RenderedItem {
  id: string
  title: string
  order: number
  content?: string
  columnId: string
}

export const CONTENT_TYPES = {
  card: 'application/app-card',
  column: 'application/app-column',
} as const

export const INTENTS = {
  updateColumnName: 'updateColumnName' as const,
  updateBoardName: 'updateBoardName' as const,
} as const

export const ItemMutationFields = {
  id: { type: String, name: 'id' },
  columnId: { type: String, name: 'columnId' },
  order: { type: Number, name: 'order' },
  title: { type: String, name: 'title' },
} as const