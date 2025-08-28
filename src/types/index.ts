// src/types/index.ts - Centralized type exports

// Re-export everything from core types
export * from './core'

// Specific exports for commonly used types
export type {
  // Convex types
  Id,
  Doc,
  
  // User types
  ConvexUser,
  UserPreferences,
  UserStats,
  
  // Project types
  Project,
  ProjectStatus,
  ProjectConfiguration,
  ProjectResourceLimits,
  ProjectStatistics,
  ProjectFilters,
  ProjectFormData,
  
  // Agent types
  Agent,
  AgentStatus,
  AgentRole,
  WorkflowPattern,
  ModelConfig,
  MemoryConfig,
  AgentPerformance,
  AgentFilters,
  AgentFormData,
  
  // Execution types
  Execution,
  ExecutionStatus,
  PriorityLevel,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowAgent,
  ExecutionProgress,
  ExecutionResults,
  ExecutionError,
  ExecutionFilters,
  ExecutionFormData,
  
  // API types
  PaginatedResponse,
  CursorPaginatedResponse,
  ApiResponse,
  
  // Performance types
  PerformanceMetrics,
  TokenUsage,
  AuditLogEntry,
  QueueStatus,
  
  // Utility types
  RequireField,
  PartialExcept,
  DeepPartial,
  SortField,
  SortOrder,
  ViewMode,
  
  // Auth types
  AuthState,
  
  // Notification types
  Notification,
  
  // Legacy types (for backwards compatibility)
  RenderedItem,
} from './core'

// Export constants
export {
  PROJECT_STATUSES,
  AGENT_STATUSES,
  AGENT_ROLES,
  WORKFLOW_PATTERNS,
  EXECUTION_STATUSES,
  PRIORITY_LEVELS,
  CONTENT_TYPES,
  INTENTS,
  ItemMutationFields,
} from './core'