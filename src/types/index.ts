// src/types/index.ts - Global Type Definitions

import { Id } from '../../convex/_generated/dataModel'

// Base types
export interface BaseEntity {
  _id: string
  _creationTime: number
}

// Project Types
export interface Project extends BaseEntity {
  name: string
  description?: string
  status: 'active' | 'paused' | 'completed' | 'archived'
  createdAt: number
  updatedAt: number
  createdBy?: string
  statistics: ProjectStatistics
  configuration: ProjectConfiguration
  resourceLimits: ProjectResourceLimits
  metadata?: Record<string, any>
}

export interface ProjectStatistics {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  totalTokensUsed: number
  totalCostIncurred: number
}

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

// Agent Types
export interface Agent extends BaseEntity {
  name: string
  projectId: string
  role: 'planner' | 'director' | 'coordinator' | 'expert' | 'builder'
  status: 'created' | 'configuring' | 'ready' | 'active' | 'paused' | 'error' | 'archived'
  description?: string
  lastActiveAt?: number
  performance: AgentPerformance
  configuration: AgentConfiguration
  memoryConfig?: AgentMemoryConfig
  capabilities: string[]
  workflowPattern?: string
  createdBy?: string
}

export interface AgentPerformance {
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  avgExecutionTime: number
  totalTokensUsed?: number
  totalCostIncurred?: number
}

export interface AgentConfiguration {
  modelConfig: ModelConfig
  parameters?: Record<string, any>
  rateLimiting?: RateLimitConfig
  resourceRequirements?: ResourceRequirements
}

export interface AgentMemoryConfig {
  contextWindow?: number
  memoryPersistence?: boolean
  sharingProtocols?: string[]
}

export interface ModelConfig {
  modelType: string
  parameters?: any
  tokenLimit?: number
  costLimit?: number
}

export interface RateLimitConfig {
  requestsPerMinute?: number
  tokensPerMinute?: number
  costPerHour?: number
}

export interface ResourceRequirements {
  memory?: number
  cpu?: number
  gpu?: boolean
}

// Execution Types
export interface Execution extends BaseEntity {
  projectId: string
  agentId?: string
  workflowId?: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  startedAt?: number
  completedAt?: number
  configuration: ExecutionConfiguration
  progress: ExecutionProgress
  workflowDefinition?: WorkflowDefinition
  performance: ExecutionPerformance
  result?: any
  error?: ExecutionError
  metadata?: Record<string, any>
}

export interface ExecutionConfiguration {
  timeout: number
  maxRetries?: number
  retryDelay?: number
  resourceLimits?: ExecutionResourceLimits
}

export interface ExecutionResourceLimits {
  maxMemory?: number
  maxCpu?: number
  maxDuration?: number
}

export interface ExecutionProgress {
  currentTaskId?: string
  completedTasks?: string[]
  totalTasks?: number
  progressPercentage?: number
  completedSteps: string[]
  failedSteps: string[]
  activeSteps: string[]
  totalSteps: number
  percentage: number
}

export interface WorkflowDefinition {
  name: string
  pattern: 'sequential' | 'parallel' | 'routing' | 'orchestrator-worker' | 'evaluator-optimizer' | 'multi-step-tool'
  steps: WorkflowStep[]
  agents?: WorkflowAgent[]
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
  metadata?: Record<string, any>
}

export interface WorkflowAgent {
  agentId: string
  role: Agent['role']
  config: Record<string, any>
  dependencies: string[]
}

export interface ExecutionPerformance {
  totalTokensUsed: number
  totalCostIncurred: number
  executionTime: number
  memoryPeak?: number
  cpuUsage?: number
}

export interface ExecutionError {
  name: string
  message: string
  stack?: string
  code?: string
  recoverable?: boolean
}

// Board Types (existing system)
export interface Board extends BaseEntity {
  name: string
  createdBy: string
  updatedAt: number
  columns: Column[]
  items: Item[]
}

export interface Column extends BaseEntity {
  title: string
  boardId: string
  order: number
}

export interface Item extends BaseEntity {
  content: string
  columnId: string
  boardId: string
  order: number
  status?: string
}

// Job Types
export interface Job extends BaseEntity {
  type: 'workflow_execution' | 'agent_training' | 'data_processing' | 'model_optimization' | 'batch_execution' | 'scheduled_task' | 'cleanup_task' | 'analytics_computation'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  payload: Record<string, any>
  scheduling: JobScheduling
  config: JobConfig
  timestamps: JobTimestamps
  history: JobHistoryEntry[]
  dependencies: string[]
  metadata: JobMetadata
  result?: any
  error?: JobError
}

export interface JobScheduling {
  scheduledAt: number
  startAfter?: number
  deadline?: number
  recurring: {
    enabled: boolean
    pattern?: string
    nextRun?: number
  }
}

export interface JobConfig {
  timeout: number
  maxRetries: number
  retryDelay: number
  concurrency: number
  resourceLimits?: {
    maxMemory?: number
    maxCpu?: number
    maxDuration?: number
  }
}

export interface JobTimestamps {
  createdAt: number
  startedAt?: number
  completedAt?: number
  lastRetryAt?: number
}

export interface JobHistoryEntry {
  timestamp: number
  event: string
  details?: Record<string, any>
}

export interface JobMetadata {
  agentId?: string
  executionId?: string
  projectId?: string
  userId?: string
  tags?: string[]
  environment?: string
}

export interface JobError {
  name: string
  message: string
  stack?: string
  code?: string
  retryable?: boolean
}

// System Health Types
export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'critical' | 'offline'
  activeAgents: number
  runningExecutions: number
  queuedExecutions: number
  avgResponseTime: number
  errorRate: number
  timestamp: number
}

// Notification Types
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

// User Types
export interface User extends BaseEntity {
  authUserId: string
  email: string
  name?: string
  role?: string
  preferences?: UserPreferences
  metadata?: Record<string, any>
}

export interface UserPreferences {
  theme?: 'light' | 'dark'
  notifications?: {
    email: boolean
    push: boolean
    inApp: boolean
  }
  dashboard?: {
    defaultView: 'grid' | 'list'
    itemsPerPage: number
  }
}

// Filter and Search Types
export type ProjectStatus = 'all' | 'active' | 'paused' | 'completed' | 'archived'
export type SortField = 'name' | 'created' | 'updated' | 'status' | 'cost' | 'executions'
export type SortOrder = 'asc' | 'desc'
export type ViewMode = 'grid' | 'list'

export interface ProjectFilters {
  status: ProjectStatus
  dateFilter: 'all' | 'today' | 'week' | 'month'
  costFilter: 'all' | 'low' | 'medium' | 'high'
  executionFilter: 'all' | 'none' | 'few' | 'many'
  searchQuery: string
  sortBy: SortField
  sortOrder: SortOrder
}

// API Response Types
export interface ApiResponse<T> {
  data?: T
  error?: string
  success: boolean
  timestamp: number
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// Form Types
export interface ProjectFormData {
  name: string
  description?: string
  configuration: ProjectConfiguration
  resourceLimits: ProjectResourceLimits
  notifications?: ProjectNotificationSettings
  advanced?: ProjectAdvancedSettings
  template?: string
  metadata?: Record<string, any>
}

export interface ProjectNotificationSettings {
  enableEmailNotifications: boolean
  enableSlackNotifications: boolean
  notifyOnFailure: boolean
  notifyOnCompletion: boolean
  notifyOnCostThreshold: boolean
  costThreshold: number
}

export interface ProjectAdvancedSettings {
  retentionDays: number
  enableDebugLogs: boolean
  enablePerformanceMetrics: boolean
  customMetadata: Record<string, any>
}

// Component Props Types
export interface ProjectCardProps {
  project: Project
  viewMode: ViewMode
  onAction: (project: Project, action: string) => void
}

export interface ProjectFiltersProps {
  filters: ProjectFilters
  onFiltersChange: (filters: Partial<ProjectFilters>) => void
  projectCount: number
}

// Utility Types
export type RequireField<T, K extends keyof T> = T & Required<Pick<T, K>>
export type PartialExcept<T, K extends keyof T> = Partial<T> & Pick<T, K>
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

// Performance Metrics Types
export interface PerformanceMetrics {
  timestamp: number
  cpuUsage: number
  memoryUsage: number
  activeConnections: number
  responseTime: number
  errorRate: number
  throughput: number
  queueSize: number
  metrics?: Record<string, number>
}

// Audit Types
export interface AuditEntry {
  id: string
  timestamp: number
  agentId: string
  event: string
  outcome: 'success' | 'failure' | 'error'
  details?: Record<string, any>
  metadata?: Record<string, any>
}

// Legacy capability types
export interface AgentCapability {
  name: string
  version: string
  enabled: boolean
  config?: Record<string, any>
}

// Execution Steps
export interface ExecutionStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  startedAt?: number
  completedAt?: number
  result?: any
  error?: string
}

// Constants
export const PROJECT_STATUSES = ['active', 'paused', 'completed', 'archived'] as const
export const AGENT_ROLES = ['planner', 'director', 'coordinator', 'expert', 'builder'] as const
export const EXECUTION_STATUSES = ['pending', 'running', 'completed', 'failed', 'cancelled', 'timeout'] as const
export const PRIORITY_LEVELS = ['low', 'normal', 'high', 'urgent'] as const