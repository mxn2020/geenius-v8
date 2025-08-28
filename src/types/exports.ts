// Explicit type re-exports to fix TypeScript module resolution issues
export type {
  // Base interfaces
  BaseEntity,
  Project,
  ProjectConfiguration,
  ProjectResourceLimits,
  ProjectStatistics,
  ProjectFormData,
  ProjectNotificationSettings,
  ProjectAdvancedSettings,
  
  // Type aliases
  ProjectStatus,
  SortField,
  SortOrder,
  ViewMode,
  
  // Agent types
  Agent,
  AgentConfiguration,
  AgentCapability,
  AgentPerformance,
  
  // Execution types  
  Execution,
  ExecutionStep,
  ExecutionProgress,
  ExecutionError,
  
  // Board types
  Board,
  Column,
  Item,
  
  // System types
  SystemHealth,
  PerformanceMetrics,
  User,
  Notification,
  
  // Job types
  Job,
  JobMetadata,
  JobError,
  
  // Audit types
  AuditEntry,
  
  // Filter types
  ProjectFilters,
  
  // Utility types
  ApiResponse,
  PaginatedResponse,
  RequireField,
  PartialExcept,
  DeepPartial
} from './index'