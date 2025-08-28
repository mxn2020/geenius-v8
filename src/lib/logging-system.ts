// src/lib/logging-system.ts

import { z } from 'zod'

// Log levels with priority ordering
export const LOG_LEVELS = {
  debug: { value: 0, name: 'DEBUG', color: '\x1b[36m' }, // Cyan
  info: { value: 1, name: 'INFO', color: '\x1b[32m' },   // Green
  warn: { value: 2, name: 'WARN', color: '\x1b[33m' },   // Yellow
  error: { value: 3, name: 'ERROR', color: '\x1b[31m' }, // Red
  fatal: { value: 4, name: 'FATAL', color: '\x1b[35m' }  // Magenta
} as const

export type LogLevel = keyof typeof LOG_LEVELS

// Log categories for different system components
export const LOG_CATEGORIES = {
  // Agent-related logging
  agent_lifecycle: 'agent_lifecycle',
  agent_execution: 'agent_execution', 
  agent_communication: 'agent_communication',
  agent_decision: 'agent_decision',
  
  // System operations
  system_startup: 'system_startup',
  system_configuration: 'system_configuration',
  system_error: 'system_error',
  
  // Resource management
  resource_allocation: 'resource_allocation',
  resource_usage: 'resource_usage',
  
  // Model operations
  model_inference: 'model_inference',
  model_selection: 'model_selection',
  
  // Workflow management
  workflow_execution: 'workflow_execution',
  workflow_coordination: 'workflow_coordination',
  
  // Security and audit
  security_event: 'security_event',
  audit_trail: 'audit_trail',
  
  // Performance monitoring
  performance_metric: 'performance_metric',
  monitoring_alert: 'monitoring_alert'
} as const

export type LogCategory = keyof typeof LOG_CATEGORIES

// Structured log entry schema
export const logEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']),
  category: z.string(),
  component: z.string(), // Which part of the system generated this log
  
  // Core message
  message: z.string(),
  
  // Contextual information
  agentId: z.string().optional(),
  executionId: z.string().optional(),
  projectId: z.string().optional(),
  userId: z.string().optional(),
  
  // Technical details
  metadata: z.record(z.string(), z.any()).default({}),
  
  // Error details (if applicable)
  error: z.object({
    name: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    code: z.string().optional()
  }).optional(),
  
  // Performance data
  performance: z.object({
    duration: z.number().optional(), // milliseconds
    memoryUsage: z.number().optional(), // bytes
    tokenCount: z.number().optional(),
    cost: z.number().optional() // USD
  }).optional(),
  
  // Correlation tracking
  correlationId: z.string().optional(),
  parentLogId: z.string().optional(),
  
  // Source location (for debugging)
  source: z.object({
    file: z.string().optional(),
    function: z.string().optional(),
    line: z.number().optional()
  }).optional()
})

export type LogEntry = z.infer<typeof logEntrySchema>

// Log configuration
export const logConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  enableConsole: z.boolean().default(true),
  enableFile: z.boolean().default(true),
  enableDatabase: z.boolean().default(true),
  
  // Output configuration
  console: z.object({
    colorize: z.boolean().default(true),
    timestamp: z.boolean().default(true),
    format: z.enum(['json', 'text', 'structured']).default('structured')
  }).default({
    colorize: true,
    timestamp: true,
    format: 'structured'
  }),
  
  // File logging
  file: z.object({
    path: z.string().default('./logs'),
    maxSize: z.number().default(10485760), // 10MB
    maxFiles: z.number().default(10),
    rotateDaily: z.boolean().default(true)
  }).default({
    path: './logs',
    maxSize: 10485760,
    maxFiles: 10,
    rotateDaily: true
  }),
  
  // Database logging
  database: z.object({
    batchSize: z.number().default(100),
    flushInterval: z.number().default(5000), // 5 seconds
    retentionDays: z.number().default(90)
  }).default({
    batchSize: 100,
    flushInterval: 5000,
    retentionDays: 90
  }),
  
  // Performance impact settings
  async: z.boolean().default(true),
  bufferSize: z.number().default(1000),
  
  // Category-specific levels
  categoryLevels: z.record(z.string(), z.enum(['debug', 'info', 'warn', 'error', 'fatal'])).default({})
})

export type LogConfig = z.infer<typeof logConfigSchema>

// Logger interface for different transport types
export interface LogTransport {
  name: string
  log(entry: LogEntry): Promise<void>
  flush?(): Promise<void>
  close?(): Promise<void>
}

// Console transport
export class ConsoleTransport implements LogTransport {
  name = 'console'
  
  constructor(private config: LogConfig['console']) {}
  
  async log(entry: LogEntry): Promise<void> {
    const formatted = this.formatEntry(entry)
    
    // Use appropriate console method based on level
    switch (entry.level) {
      case 'debug':
        console.debug(formatted)
        break
      case 'info':
        console.info(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'error':
      case 'fatal':
        console.error(formatted)
        break
    }
  }
  
  private formatEntry(entry: LogEntry): string {
    const level = LOG_LEVELS[entry.level]
    const timestamp = new Date(entry.timestamp).toISOString()
    
    if (this.config.format === 'json') {
      return JSON.stringify(entry)
    }
    
    if (this.config.format === 'text') {
      return `${timestamp} [${level.name}] ${entry.component}: ${entry.message}`
    }
    
    // Structured format
    const color = this.config.colorize ? level.color : ''
    const reset = this.config.colorize ? '\x1b[0m' : ''
    const ts = this.config.timestamp ? `${timestamp} ` : ''
    
    let formatted = `${color}${ts}[${level.name}] ${entry.component}:${reset} ${entry.message}`
    
    // Add contextual info
    const context = []
    if (entry.agentId) context.push(`agent=${entry.agentId}`)
    if (entry.executionId) context.push(`exec=${entry.executionId}`)
    if (entry.correlationId) context.push(`corr=${entry.correlationId}`)
    
    if (context.length > 0) {
      formatted += ` {${context.join(', ')}}`
    }
    
    // Add performance data
    if (entry.performance) {
      const perf = []
      if (entry.performance.duration) perf.push(`${entry.performance.duration}ms`)
      if (entry.performance.tokenCount) perf.push(`${entry.performance.tokenCount}t`)
      if (entry.performance.cost) perf.push(`$${entry.performance.cost.toFixed(4)}`)
      
      if (perf.length > 0) {
        formatted += ` [${perf.join(', ')}]`
      }
    }
    
    // Add error details
    if (entry.error) {
      formatted += `\n  Error: ${entry.error.name}: ${entry.error.message}`
      if (entry.error.stack && entry.level === 'debug') {
        formatted += `\n  Stack: ${entry.error.stack}`
      }
    }
    
    return formatted
  }
}

// Database transport (stores logs in Convex)
export class DatabaseTransport implements LogTransport {
  name = 'database'
  private buffer: LogEntry[] = []
  private flushTimer: NodeJS.Timeout | null = null
  
  constructor(private config: LogConfig['database']) {
    this.startFlushTimer()
  }
  
  async log(entry: LogEntry): Promise<void> {
    this.buffer.push(entry)
    
    if (this.buffer.length >= this.config.batchSize) {
      await this.flush()
    }
  }
  
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return
    
    const batch = this.buffer.splice(0, this.config.batchSize)
    
    try {
      // In a real implementation, this would call a Convex mutation
      // For now, we'll just simulate the database write
      await this.writeBatchToDatabase(batch)
    } catch (error) {
      // On error, put entries back in buffer for retry
      this.buffer.unshift(...batch)
      throw error
    }
  }
  
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    await this.flush()
  }
  
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error)
    }, this.config.flushInterval)
  }
  
  private async writeBatchToDatabase(entries: LogEntry[]): Promise<void> {
    // TODO: Implement Convex mutation call
    // This would call something like: await ctx.db.insert("logs", entry)
    console.debug(`Writing ${entries.length} log entries to database`)
  }
}

// File transport
export class FileTransport implements LogTransport {
  name = 'file'
  
  constructor(private config: LogConfig['file']) {}
  
  async log(entry: LogEntry): Promise<void> {
    // TODO: Implement file logging with rotation
    // This would use fs.appendFile with proper rotation logic
    console.debug(`Writing log entry to file: ${entry.message}`)
  }
  
  async flush(): Promise<void> {
    // Ensure all buffered writes are flushed to disk
  }
}

// Main Logger class
export class Logger {
  private transports: LogTransport[] = []
  private config: LogConfig
  private buffer: LogEntry[] = []
  
  constructor(config: Partial<LogConfig> = {}) {
    this.config = logConfigSchema.parse(config)
    this.setupTransports()
  }
  
  private setupTransports(): void {
    if (this.config.enableConsole) {
      this.transports.push(new ConsoleTransport(this.config.console))
    }
    
    if (this.config.enableDatabase) {
      this.transports.push(new DatabaseTransport(this.config.database))
    }
    
    if (this.config.enableFile) {
      this.transports.push(new FileTransport(this.config.file))
    }
  }
  
  // Core logging methods
  debug(message: string, context?: Partial<LogEntry>): void {
    this.log('debug', message, context)
  }
  
  info(message: string, context?: Partial<LogEntry>): void {
    this.log('info', message, context)
  }
  
  warn(message: string, context?: Partial<LogEntry>): void {
    this.log('warn', message, context)
  }
  
  error(message: string, error?: Error, context?: Partial<LogEntry>): void {
    const errorContext: Partial<LogEntry> = {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    }
    this.log('error', message, errorContext)
  }
  
  fatal(message: string, error?: Error, context?: Partial<LogEntry>): void {
    const errorContext: Partial<LogEntry> = {
      ...context,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code
      } : undefined
    }
    this.log('fatal', message, errorContext)
  }
  
  private log(level: LogLevel, message: string, context: Partial<LogEntry> = {}): void {
    // Check if this log level should be processed
    if (!this.shouldLog(level, context.category)) {
      return
    }
    
    const entry: LogEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      level,
      category: context.category || 'general',
      component: context.component || 'unknown',
      message,
      agentId: context.agentId,
      executionId: context.executionId,
      projectId: context.projectId,
      userId: context.userId,
      metadata: context.metadata || {},
      error: context.error,
      performance: context.performance,
      correlationId: context.correlationId,
      parentLogId: context.parentLogId,
      source: context.source
    }
    
    if (this.config.async) {
      // Non-blocking logging
      setImmediate(() => this.writeToTransports(entry))
    } else {
      // Synchronous logging
      this.writeToTransports(entry)
    }
  }
  
  private shouldLog(level: LogLevel, category?: string): boolean {
    const levelValue = LOG_LEVELS[level].value
    
    // Check category-specific level first
    if (category && this.config.categoryLevels[category]) {
      const categoryLevelValue = LOG_LEVELS[this.config.categoryLevels[category]].value
      return levelValue >= categoryLevelValue
    }
    
    // Fall back to global level
    return levelValue >= LOG_LEVELS[this.config.level].value
  }
  
  private async writeToTransports(entry: LogEntry): Promise<void> {
    const promises = this.transports.map(transport => 
      transport.log(entry).catch(error => 
        console.error(`Transport ${transport.name} failed:`, error)
      )
    )
    
    await Promise.allSettled(promises)
  }
  
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }
  
  // Utility methods for structured logging
  startTimer(name: string): () => void {
    const start = Date.now()
    return () => {
      const duration = Date.now() - start
      this.debug(`Timer ${name} completed`, {
        category: LOG_CATEGORIES.performance_metric,
        performance: { duration }
      })
      return duration
    }
  }
  
  // Create child logger with preset context
  child(context: Partial<LogEntry>): Logger {
    const childLogger = new Logger(this.config)
    
    // Override the log method to include preset context
    const originalLog = childLogger.log.bind(childLogger)
    childLogger.log = (level: LogLevel, message: string, additionalContext: Partial<LogEntry> = {}) => {
      return originalLog(level, message, { ...context, ...additionalContext })
    }
    
    return childLogger
  }
  
  // Flush all transports
  async flush(): Promise<void> {
    const promises = this.transports
      .filter(transport => transport.flush)
      .map(transport => transport.flush!())
    
    await Promise.allSettled(promises)
  }
  
  // Close all transports
  async close(): Promise<void> {
    const promises = this.transports
      .filter(transport => transport.close)
      .map(transport => transport.close!())
    
    await Promise.allSettled(promises)
  }
}

// Global logger instance
export const logger = new Logger()

// Specialized loggers for different components
export const agentLogger = logger.child({
  component: 'agent',
  category: LOG_CATEGORIES.agent_execution
})

export const systemLogger = logger.child({
  component: 'system',
  category: LOG_CATEGORIES.system_startup
})

export const performanceLogger = logger.child({
  component: 'performance',
  category: LOG_CATEGORIES.performance_metric
})

export const auditLogger = logger.child({
  component: 'audit',
  category: LOG_CATEGORIES.audit_trail
})

// Helper functions for common logging patterns
export const logAgentAction = (
  agentId: string,
  action: string,
  executionId?: string,
  metadata?: Record<string, any>
) => {
  agentLogger.info(`Agent action: ${action}`, {
    agentId,
    executionId,
    metadata
  })
}

export const logPerformance = (
  operation: string,
  duration: number,
  metadata?: Record<string, any>
) => {
  performanceLogger.info(`Performance: ${operation}`, {
    performance: { duration },
    metadata
  })
}

export const logAuditEvent = (
  event: string,
  userId?: string,
  agentId?: string,
  metadata?: Record<string, any>
) => {
  auditLogger.info(`Audit: ${event}`, {
    userId,
    agentId,
    metadata
  })
}

export const withLogging = <T extends (...args: any[]) => any>(
  fn: T,
  name: string,
  logger: Logger = systemLogger
): T => {
  return ((...args: any[]) => {
    const timer = logger.startTimer(name)
    
    try {
      const result = fn(...args)
      
      // Handle async functions
      if (result instanceof Promise) {
        return result
          .then(value => {
            timer()
            return value
          })
          .catch(error => {
            timer()
            logger.error(`Function ${name} failed`, error)
            throw error
          })
      }
      
      timer()
      return result
    } catch (error) {
      timer()
      logger.error(`Function ${name} failed`, error as Error)
      throw error
    }
  }) as T
}