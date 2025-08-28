// src/lib/error-recovery-system.ts - Error Handling and Recovery Mechanisms for Failed Executions

import { z } from 'zod'
import { logger } from './logging-system'
import { auditSystem } from './audit-system'
import { realtimeMonitor } from './realtime-monitoring'
import { backgroundJobProcessor, addBackgroundJob } from './background-job-processor'
import { executionEngine, ExecutionState, ExecutionContext } from './execution-engine'

// Error classification schemas
export const errorClassificationSchema = z.object({
  category: z.enum([
    'transient', // Temporary issues that may resolve
    'resource', // Resource exhaustion or limits
    'configuration', // Configuration errors
    'external', // External service failures
    'validation', // Input validation errors
    'authentication', // Auth/permission errors
    'timeout', // Execution timeouts
    'system', // System-level errors
    'unknown' // Unclassified errors
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  recoverable: z.boolean(),
  retryable: z.boolean(),
  escalatable: z.boolean()
})

export type ErrorClassification = z.infer<typeof errorClassificationSchema>

export const recoveryActionSchema = z.object({
  id: z.string(),
  type: z.enum([
    'retry', // Simple retry with backoff
    'retry_with_fallback', // Retry with different configuration
    'circuit_breaker', // Stop processing temporarily
    'resource_scaling', // Scale up resources
    'failover', // Switch to backup system
    'rollback', // Revert to previous state
    'manual_intervention', // Require human intervention
    'ignore', // Log and continue
    'terminate', // Stop execution permanently
    'escalate' // Escalate to higher level
  ]),
  priority: z.number().min(1).max(10),
  autoExecute: z.boolean().default(false),
  conditions: z.array(z.object({
    field: z.string(),
    operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'contains']),
    value: z.any()
  })).default([]),
  parameters: z.record(z.string(), z.any()).default({}),
  timeout: z.number().default(300000), // 5 minutes
  maxAttempts: z.number().default(3)
})

export type RecoveryAction = z.infer<typeof recoveryActionSchema>

export const recoveryContextSchema = z.object({
  executionId: z.string(),
  agentId: z.string().optional(),
  projectId: z.string().optional(),
  
  // Error information
  error: z.object({
    name: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    code: z.string().optional(),
    timestamp: z.number(),
    context: z.record(z.string(), z.any()).default({})
  }),
  
  // Execution context
  executionState: z.any().optional(), // ExecutionState
  originalContext: z.any().optional(), // ExecutionContext
  
  // Recovery attempt tracking
  recoveryAttempts: z.array(z.object({
    actionId: z.string(),
    actionType: z.string(),
    timestamp: z.number(),
    success: z.boolean(),
    error: z.string().optional(),
    metadata: z.record(z.string(), z.any()).default({})
  })).default([]),
  
  // Classification
  classification: errorClassificationSchema.optional(),
  
  // Recovery state
  recoveryState: z.enum(['pending', 'in_progress', 'completed', 'failed', 'abandoned']).default('pending'),
  
  metadata: z.record(z.string(), z.any()).default({})
})

export type RecoveryContext = z.infer<typeof recoveryContextSchema>

// Recovery rule schema
export const recoveryRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  
  // Matching conditions
  conditions: z.object({
    errorTypes: z.array(z.string()).default([]),
    errorMessages: z.array(z.string()).default([]),
    errorCodes: z.array(z.string()).default([]),
    agentTypes: z.array(z.string()).default([]),
    executionPatterns: z.array(z.string()).default([]),
    customConditions: z.array(z.object({
      field: z.string(),
      operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'contains', 'matches']),
      value: z.any()
    })).default([])
  }).default({
    errorTypes: [],
    errorMessages: [],
    errorCodes: [],
    agentTypes: [],
    executionPatterns: [],
    customConditions: []
  }),
  
  // Recovery actions to execute
  actions: z.array(recoveryActionSchema),
  
  // Rule configuration
  config: z.object({
    enabled: z.boolean().default(true),
    priority: z.number().default(100),
    maxExecutions: z.number().optional(),
    cooldownMs: z.number().default(60000),
    executeInParallel: z.boolean().default(false)
  }).default({
    enabled: true,
    priority: 100,
    cooldownMs: 60000,
    executeInParallel: false
  }),
  
  // Statistics
  stats: z.object({
    totalExecutions: z.number().default(0),
    successfulExecutions: z.number().default(0),
    failedExecutions: z.number().default(0),
    lastExecuted: z.number().optional(),
    avgExecutionTime: z.number().default(0)
  }).default({
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    avgExecutionTime: 0
  }),
  
  metadata: z.record(z.string(), z.any()).default({})
})

export type RecoveryRule = z.infer<typeof recoveryRuleSchema>

// Recovery strategy configuration
export const recoveryStrategyConfigSchema = z.object({
  // Global settings
  global: z.object({
    enableAutoRecovery: z.boolean().default(true),
    maxConcurrentRecoveries: z.number().default(10),
    recoveryTimeout: z.number().default(1800000), // 30 minutes
    enableCircuitBreaker: z.boolean().default(true),
    circuitBreakerThreshold: z.number().default(5),
    circuitBreakerCooldown: z.number().default(300000) // 5 minutes
  }).default({
    enableAutoRecovery: true,
    maxConcurrentRecoveries: 10,
    recoveryTimeout: 1800000,
    enableCircuitBreaker: true,
    circuitBreakerThreshold: 5,
    circuitBreakerCooldown: 300000
  }),
  
  // Error classification rules
  classification: z.object({
    enableAutoClassification: z.boolean().default(true),
    useMLClassification: z.boolean().default(false),
    fallbackClassification: errorClassificationSchema.default({
      category: 'unknown',
      severity: 'medium',
      recoverable: true,
      retryable: true,
      escalatable: false
    })
  }).default({
    enableAutoClassification: true,
    useMLClassification: false,
    fallbackClassification: {
      category: 'unknown',
      severity: 'medium',
      recoverable: true,
      retryable: true,
      escalatable: false
    }
  }),
  
  // Retry configuration
  retry: z.object({
    defaultMaxAttempts: z.number().default(3),
    exponentialBackoff: z.boolean().default(true),
    backoffMultiplier: z.number().default(2),
    maxBackoffDelay: z.number().default(300000), // 5 minutes
    jitter: z.boolean().default(true)
  }).default({
    defaultMaxAttempts: 3,
    exponentialBackoff: true,
    backoffMultiplier: 2,
    maxBackoffDelay: 300000,
    jitter: true
  }),
  
  // Escalation settings
  escalation: z.object({
    enableAutoEscalation: z.boolean().default(true),
    escalationTimeout: z.number().default(3600000), // 1 hour
    escalationLevels: z.array(z.object({
      level: z.number(),
      name: z.string(),
      condition: z.string(),
      actions: z.array(z.string())
    })).default([])
  }).default({
    enableAutoEscalation: true,
    escalationTimeout: 3600000,
    escalationLevels: []
  }),
  
  // Monitoring and alerting
  monitoring: z.object({
    enableMetrics: z.boolean().default(true),
    enableAlerting: z.boolean().default(true),
    alertThresholds: z.object({
      recoveryFailureRate: z.number().default(0.3),
      recoveryLatency: z.number().default(60000),
      concurrentRecoveries: z.number().default(5)
    }).default({
      recoveryFailureRate: 0.3,
      recoveryLatency: 60000,
      concurrentRecoveries: 5
    })
  }).default({
    enableMetrics: true,
    enableAlerting: true,
    alertThresholds: {
      recoveryFailureRate: 0.3,
      recoveryLatency: 60000,
      concurrentRecoveries: 5
    }
  })
})

export type RecoveryStrategyConfig = z.infer<typeof recoveryStrategyConfigSchema>

// Error recovery system class
export class ErrorRecoverySystem {
  private config: RecoveryStrategyConfig
  private recoveryRules = new Map<string, RecoveryRule>()
  private activeRecoveries = new Map<string, RecoveryContext>()
  private circuitBreakers = new Map<string, CircuitBreaker>()
  private errorClassifier: ErrorClassifier
  private recoveryExecutor: RecoveryExecutor
  
  constructor(config: Partial<RecoveryStrategyConfig> = {}) {
    this.config = recoveryStrategyConfigSchema.parse(config)
    this.errorClassifier = new ErrorClassifier(this.config.classification)
    this.recoveryExecutor = new RecoveryExecutor(this.config)
    
    this.setupDefaultRules()
    
    logger.info('Error recovery system initialized', {
      category: 'system_startup',
      component: 'error-recovery-system',
      metadata: {
        autoRecoveryEnabled: this.config.global.enableAutoRecovery,
        circuitBreakerEnabled: this.config.global.enableCircuitBreaker,
        rulesCount: this.recoveryRules.size
      }
    })
  }
  
  // Main error handling entry point
  async handleError(
    executionId: string,
    error: Error,
    context: {
      agentId?: string
      projectId?: string
      executionState?: ExecutionState
      originalContext?: ExecutionContext
      metadata?: Record<string, any>
    } = {}
  ): Promise<RecoveryContext> {
    
    // Create recovery context
    const recoveryContext: RecoveryContext = {
      executionId,
      agentId: context.agentId,
      projectId: context.projectId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        timestamp: Date.now(),
        context: context.metadata || {}
      },
      executionState: context.executionState,
      originalContext: context.originalContext,
      recoveryAttempts: [],
      recoveryState: 'pending',
      metadata: {}
    }
    
    try {
      // Classify error
      recoveryContext.classification = await this.errorClassifier.classifyError(error, recoveryContext)
      
      // Check circuit breaker
      if (this.config.global.enableCircuitBreaker) {
        const breakerKey = context.agentId || 'global'
        const circuitBreaker = this.getCircuitBreaker(breakerKey)
        
        if (!circuitBreaker.allowRequest()) {
          logger.warn('Circuit breaker open, skipping recovery', {
            category: 'error_recovery',
            component: 'error-recovery-system',
            executionId,
            metadata: { breakerKey, classification: recoveryContext.classification }
          })
          
          recoveryContext.recoveryState = 'abandoned'
          return recoveryContext
        }
      }
      
      // Check if recovery should be attempted
      if (!recoveryContext.classification.recoverable) {
        logger.info('Error marked as non-recoverable, skipping recovery', {
          category: 'error_recovery',
          component: 'error-recovery-system',
          executionId,
          metadata: { classification: recoveryContext.classification }
        })
        
        recoveryContext.recoveryState = 'abandoned'
        return recoveryContext
      }
      
      // Check concurrent recovery limit
      if (this.activeRecoveries.size >= this.config.global.maxConcurrentRecoveries) {
        logger.warn('Maximum concurrent recoveries exceeded, queuing recovery', {
          category: 'error_recovery',
          component: 'error-recovery-system',
          executionId,
          metadata: { activeRecoveries: this.activeRecoveries.size }
        })
        
        // Queue recovery as background job
        await this.queueRecovery(recoveryContext)
        return recoveryContext
      }
      
      // Start recovery process
      this.activeRecoveries.set(executionId, recoveryContext)
      recoveryContext.recoveryState = 'in_progress'
      
      // Audit recovery start
      auditSystem.audit(
        'recovery_started',
        {
          type: 'agent',
          id: context.agentId || 'system'
        },
        {
          description: `Recovery started for ${error.name}`,
          action: 'recovery',
          outcome: 'pending'
        },
        {
          category: 'system',
          severity: 'medium',
          metadata: {
            executionId,
            errorType: error.name,
            classification: recoveryContext.classification,
            recoveryRulesCount: this.recoveryRules.size
          }
        }
      )
      
      // Execute recovery
      await this.executeRecovery(recoveryContext)
      
    } catch (recoveryError) {
      logger.error('Recovery process failed', recoveryError as Error, {
        category: 'error_recovery',
        component: 'error-recovery-system',
        executionId,
        metadata: { originalError: error.message }
      })
      
      recoveryContext.recoveryState = 'failed'
      recoveryContext.error.context.recoveryError = (recoveryError as Error).message
    } finally {
      this.activeRecoveries.delete(executionId)
    }
    
    return recoveryContext
  }
  
  // Recovery execution
  private async executeRecovery(context: RecoveryContext): Promise<void> {
    // Find applicable recovery rules
    const applicableRules = this.findApplicableRules(context)
    
    if (applicableRules.length === 0) {
      logger.info('No applicable recovery rules found', {
        category: 'error_recovery',
        component: 'error-recovery-system',
        executionId: context.executionId,
        metadata: {
          errorType: context.error.name,
          classification: context.classification
        }
      })
      
      // Apply default recovery strategy
      await this.executeDefaultRecovery(context)
      return
    }
    
    // Sort rules by priority
    applicableRules.sort((a, b) => b.config.priority - a.config.priority)
    
    // Execute recovery rules
    for (const rule of applicableRules) {
      if (context.recoveryState === 'completed') break
      
      try {
        await this.executeRecoveryRule(rule, context)
        
        // Update rule statistics
        this.updateRuleStats(rule, true)
        
      } catch (error) {
        logger.error('Recovery rule execution failed', error as Error, {
          category: 'error_recovery',
          component: 'error-recovery-system',
          executionId: context.executionId,
          metadata: { ruleId: rule.id }
        })
        
        // Update rule statistics
        this.updateRuleStats(rule, false)
        
        // Continue with next rule if this one failed
        continue
      }
    }
    
    // Check if recovery was successful
    if (context.recoveryState === 'in_progress') {
      context.recoveryState = 'failed'
    }
  }
  
  private async executeRecoveryRule(rule: RecoveryRule, context: RecoveryContext): Promise<void> {
    logger.info('Executing recovery rule', {
      category: 'error_recovery',
      component: 'error-recovery-system',
      executionId: context.executionId,
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        actionsCount: rule.actions.length
      }
    })
    
    const ruleStartTime = Date.now()
    
    try {
      if (rule.config.executeInParallel) {
        // Execute actions in parallel
        const actionPromises = rule.actions.map(action => 
          this.executeRecoveryAction(action, context)
        )
        await Promise.all(actionPromises)
      } else {
        // Execute actions sequentially
        for (const action of rule.actions) {
          await this.executeRecoveryAction(action, context)
          
          // Check if recovery completed successfully
          if (context.recoveryState === 'completed') {
            break
          }
        }
      }
      
      // Mark rule execution as successful
      rule.stats.successfulExecutions++
      
    } catch (error) {
      rule.stats.failedExecutions++
      throw error
    } finally {
      rule.stats.totalExecutions++
      rule.stats.lastExecuted = Date.now()
      
      const executionTime = Date.now() - ruleStartTime
      rule.stats.avgExecutionTime = (rule.stats.avgExecutionTime * (rule.stats.totalExecutions - 1) + executionTime) / rule.stats.totalExecutions
    }
  }
  
  private async executeRecoveryAction(action: RecoveryAction, context: RecoveryContext): Promise<void> {
    const attempt = {
      actionId: action.id,
      actionType: action.type,
      timestamp: Date.now(),
      success: false,
      metadata: {}
    }
    
    try {
      logger.debug('Executing recovery action', {
        category: 'error_recovery',
        component: 'error-recovery-system',
        executionId: context.executionId,
        metadata: {
          actionType: action.type,
          actionId: action.id
        }
      })
      
      const result = await this.recoveryExecutor.executeAction(action, context)
      
      attempt.success = result.success
      attempt.metadata = result.metadata || {}
      
      if (result.success) {
        if (result.recoveryCompleted) {
          context.recoveryState = 'completed'
        }
      } else {
        (attempt as any).error = result.error
      }
      
    } catch (error) {
      attempt.success = false
      ;(attempt as any).error = (error as Error).message
      
      logger.error('Recovery action execution failed', error as Error, {
        category: 'error_recovery',
        component: 'error-recovery-system',
        executionId: context.executionId,
        metadata: {
          actionType: action.type,
          actionId: action.id
        }
      })
    } finally {
      context.recoveryAttempts.push(attempt)
    }
  }
  
  private async executeDefaultRecovery(context: RecoveryContext): Promise<void> {
    // Default recovery strategy based on error classification
    const classification = context.classification
    if (!classification) return
    
    if (classification.retryable && classification.category === 'transient') {
      // Simple retry for transient errors
      const retryAction: RecoveryAction = {
        id: 'default_retry',
        type: 'retry',
        priority: 5,
        autoExecute: true,
        conditions: [],
        parameters: {
          maxAttempts: this.config.retry.defaultMaxAttempts,
          backoffMs: 1000
        },
        timeout: 60000,
        maxAttempts: this.config.retry.defaultMaxAttempts
      }
      
      await this.executeRecoveryAction(retryAction, context)
    } else if (classification.escalatable) {
      // Escalate for critical errors
      const escalateAction: RecoveryAction = {
        id: 'default_escalate',
        type: 'escalate',
        priority: 10,
        autoExecute: true,
        conditions: [],
        parameters: {
          level: 1,
          reason: 'Automatic escalation for non-recoverable error'
        },
        timeout: 30000,
        maxAttempts: 1
      }
      
      await this.executeRecoveryAction(escalateAction, context)
    }
  }
  
  // Rule management
  addRecoveryRule(rule: RecoveryRule): void {
    const validatedRule = recoveryRuleSchema.parse(rule)
    this.recoveryRules.set(rule.id, validatedRule)
    
    logger.info('Recovery rule added', {
      category: 'system_configuration',
      component: 'error-recovery-system',
      metadata: {
        ruleId: rule.id,
        ruleName: rule.name,
        actionsCount: rule.actions.length
      }
    })
  }
  
  removeRecoveryRule(ruleId: string): boolean {
    const removed = this.recoveryRules.delete(ruleId)
    
    if (removed) {
      logger.info('Recovery rule removed', {
        category: 'system_configuration',
        component: 'error-recovery-system',
        metadata: { ruleId }
      })
    }
    
    return removed
  }
  
  getRecoveryRule(ruleId: string): RecoveryRule | null {
    return this.recoveryRules.get(ruleId) || null
  }
  
  listRecoveryRules(): RecoveryRule[] {
    return Array.from(this.recoveryRules.values())
  }
  
  // Rule matching
  private findApplicableRules(context: RecoveryContext): RecoveryRule[] {
    const applicableRules: RecoveryRule[] = []
    
    for (const rule of this.recoveryRules.values()) {
      if (!rule.config.enabled) continue
      
      if (this.isRuleApplicable(rule, context)) {
        applicableRules.push(rule)
      }
    }
    
    return applicableRules
  }
  
  private isRuleApplicable(rule: RecoveryRule, context: RecoveryContext): boolean {
    const conditions = rule.conditions
    
    // Check error type matching
    if (conditions.errorTypes.length > 0) {
      if (!conditions.errorTypes.includes(context.error.name)) {
        return false
      }
    }
    
    // Check error message matching
    if (conditions.errorMessages.length > 0) {
      const messageMatch = conditions.errorMessages.some(pattern => 
        context.error.message.toLowerCase().includes(pattern.toLowerCase())
      )
      if (!messageMatch) return false
    }
    
    // Check error code matching
    if (conditions.errorCodes.length > 0 && context.error.code) {
      if (!conditions.errorCodes.includes(context.error.code)) {
        return false
      }
    }
    
    // Check agent type matching
    if (conditions.agentTypes.length > 0 && context.agentId) {
      // Would need agent registry to check agent type
      // For now, skip this check
    }
    
    // Check custom conditions
    for (const condition of conditions.customConditions) {
      if (!this.evaluateCondition(condition, context)) {
        return false
      }
    }
    
    // Check cooldown
    if (rule.stats.lastExecuted) {
      const timeSinceLastExecution = Date.now() - rule.stats.lastExecuted
      if (timeSinceLastExecution < rule.config.cooldownMs) {
        return false
      }
    }
    
    // Check execution limit
    if (rule.config.maxExecutions && rule.stats.totalExecutions >= rule.config.maxExecutions) {
      return false
    }
    
    return true
  }
  
  private evaluateCondition(condition: any, context: RecoveryContext): boolean {
    // Simplified condition evaluation
    try {
      const fieldValue = this.getFieldValue(condition.field, context)
      
      switch (condition.operator) {
        case 'eq': return fieldValue === condition.value
        case 'ne': return fieldValue !== condition.value
        case 'gt': return fieldValue > condition.value
        case 'lt': return fieldValue < condition.value
        case 'gte': return fieldValue >= condition.value
        case 'lte': return fieldValue <= condition.value
        case 'in': return Array.isArray(condition.value) && condition.value.includes(fieldValue)
        case 'contains': return String(fieldValue).includes(String(condition.value))
        case 'matches': return new RegExp(condition.value).test(String(fieldValue))
        default: return false
      }
    } catch {
      return false
    }
  }
  
  private getFieldValue(fieldPath: string, context: RecoveryContext): any {
    const parts = fieldPath.split('.')
    let value: any = context
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = value[part]
      } else {
        return undefined
      }
    }
    
    return value
  }
  
  // Utility methods
  private setupDefaultRules(): void {
    // Add some default recovery rules
    
    // Transient error retry rule
    this.addRecoveryRule({
      id: 'transient_retry',
      name: 'Transient Error Retry',
      description: 'Retry transient errors with exponential backoff',
      conditions: {
        errorTypes: ['TimeoutError', 'ConnectionError', 'ServiceUnavailableError'],
        errorMessages: [],
        errorCodes: [],
        agentTypes: [],
        executionPatterns: [],
        customConditions: [{
          field: 'classification.category',
          operator: 'eq',
          value: 'transient'
        }]
      },
      actions: [{
        id: 'exponential_retry',
        type: 'retry',
        priority: 5,
        autoExecute: true,
        conditions: [],
        parameters: {
          maxAttempts: 3,
          exponentialBackoff: true,
          backoffMultiplier: 2,
          maxBackoffDelay: 60000
        },
        timeout: 300000,
        maxAttempts: 3
      }],
      config: {
        enabled: true,
        priority: 100,
        cooldownMs: 30000,
        executeInParallel: false
      },
      stats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0
      },
      metadata: {}
    })
    
    // Resource error scaling rule
    this.addRecoveryRule({
      id: 'resource_scaling',
      name: 'Resource Scaling Recovery',
      description: 'Scale resources when hitting resource limits',
      conditions: {
        errorTypes: ['OutOfMemoryError', 'ResourceExhaustedError'],
        errorMessages: [],
        errorCodes: [],
        agentTypes: [],
        executionPatterns: [],
        customConditions: [{
          field: 'classification.category',
          operator: 'eq',
          value: 'resource'
        }]
      },
      actions: [{
        id: 'scale_resources',
        type: 'resource_scaling',
        priority: 8,
        autoExecute: false, // Requires approval
        conditions: [],
        parameters: {
          scaleType: 'memory',
          scaleFactor: 1.5,
          maxScale: 4
        },
        timeout: 600000,
        maxAttempts: 1
      }],
      config: {
        enabled: true,
        priority: 200,
        cooldownMs: 300000,
        executeInParallel: false
      },
      stats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0
      },
      metadata: {}
    })
    
    // Critical error escalation rule
    this.addRecoveryRule({
      id: 'critical_escalation',
      name: 'Critical Error Escalation',
      description: 'Escalate critical errors to human operators',
      conditions: {
        errorTypes: [],
        errorMessages: [],
        errorCodes: [],
        agentTypes: [],
        executionPatterns: [],
        customConditions: [{
          field: 'classification.severity',
          operator: 'eq',
          value: 'critical'
        }]
      },
      actions: [{
        id: 'escalate_critical',
        type: 'escalate',
        priority: 10,
        autoExecute: true,
        conditions: [],
        parameters: {
          level: 2,
          urgency: 'high',
          channels: ['slack', 'email', 'pager']
        },
        timeout: 60000,
        maxAttempts: 1
      }],
      config: {
        enabled: true,
        priority: 300,
        cooldownMs: 0,
        executeInParallel: false
      },
      stats: {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        avgExecutionTime: 0
      },
      metadata: {}
    })
  }
  
  private updateRuleStats(rule: RecoveryRule, success: boolean): void {
    if (success) {
      rule.stats.successfulExecutions++
    } else {
      rule.stats.failedExecutions++
    }
    rule.stats.totalExecutions++
    rule.stats.lastExecuted = Date.now()
  }
  
  private getCircuitBreaker(key: string): CircuitBreaker {
    let breaker = this.circuitBreakers.get(key)
    if (!breaker) {
      breaker = new CircuitBreaker(
        this.config.global.circuitBreakerThreshold,
        this.config.global.circuitBreakerCooldown
      )
      this.circuitBreakers.set(key, breaker)
    }
    return breaker
  }
  
  private async queueRecovery(context: RecoveryContext): Promise<void> {
    await addBackgroundJob('batch_execution', {
      type: 'error_recovery',
      context
    }, {
      priority: 'high',
      metadata: {
        tags: ['error-recovery'],
        childJobIds: [],
        executionId: context.executionId,
        errorType: context.error.name
      } as any
    })
  }
  
  // Statistics and monitoring
  getRecoveryStatistics() {
    const totalRules = this.recoveryRules.size
    const activeRecoveries = this.activeRecoveries.size
    
    let totalExecutions = 0
    let successfulExecutions = 0
    let failedExecutions = 0
    
    for (const rule of this.recoveryRules.values()) {
      totalExecutions += rule.stats.totalExecutions
      successfulExecutions += rule.stats.successfulExecutions
      failedExecutions += rule.stats.failedExecutions
    }
    
    const successRate = totalExecutions > 0 ? successfulExecutions / totalExecutions : 0
    
    return {
      totalRules,
      activeRecoveries,
      ruleStatistics: {
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        successRate
      },
      circuitBreakerStatus: Object.fromEntries(
        Array.from(this.circuitBreakers.entries()).map(([key, breaker]) => [
          key, 
          {
            state: breaker.getState(),
            failures: breaker.getFailureCount(),
            nextAttempt: breaker.getNextAttemptTime()
          }
        ])
      )
    }
  }
  
  async healthCheck(): Promise<{
    healthy: boolean
    issues: string[]
    metrics: Record<string, any>
  }> {
    const issues: string[] = []
    const metrics = this.getRecoveryStatistics()
    
    // Check if recovery system is overloaded
    if (this.activeRecoveries.size > this.config.monitoring.alertThresholds.concurrentRecoveries) {
      issues.push(`High concurrent recoveries: ${this.activeRecoveries.size}`)
    }
    
    // Check recovery success rate
    if (metrics.ruleStatistics.successRate < (1 - this.config.monitoring.alertThresholds.recoveryFailureRate)) {
      issues.push(`Low recovery success rate: ${(metrics.ruleStatistics.successRate * 100).toFixed(1)}%`)
    }
    
    // Check circuit breaker states
    for (const [key, status] of Object.entries(metrics.circuitBreakerStatus)) {
      if (status.state === 'open') {
        issues.push(`Circuit breaker open: ${key}`)
      }
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      metrics
    }
  }
}

// Error classifier
class ErrorClassifier {
  constructor(private config: RecoveryStrategyConfig['classification']) {}
  
  async classifyError(error: Error, context: RecoveryContext): Promise<ErrorClassification> {
    if (this.config.enableAutoClassification) {
      return this.autoClassifyError(error, context)
    }
    
    return this.config.fallbackClassification
  }
  
  private autoClassifyError(error: Error, context: RecoveryContext): ErrorClassification {
    // Basic error classification based on error type and message
    const errorName = error.name.toLowerCase()
    const errorMessage = error.message.toLowerCase()
    
    // Timeout errors
    if (errorName.includes('timeout') || errorMessage.includes('timeout')) {
      return {
        category: 'timeout',
        severity: 'medium',
        recoverable: true,
        retryable: true,
        escalatable: false
      }
    }
    
    // Connection errors
    if (errorName.includes('connection') || errorMessage.includes('connection')) {
      return {
        category: 'external',
        severity: 'medium',
        recoverable: true,
        retryable: true,
        escalatable: false
      }
    }
    
    // Authentication errors
    if (errorName.includes('auth') || errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
      return {
        category: 'authentication',
        severity: 'high',
        recoverable: false,
        retryable: false,
        escalatable: true
      }
    }
    
    // Validation errors
    if (errorName.includes('validation') || errorMessage.includes('validation') || errorMessage.includes('invalid')) {
      return {
        category: 'validation',
        severity: 'medium',
        recoverable: false,
        retryable: false,
        escalatable: false
      }
    }
    
    // Resource errors
    if (errorName.includes('memory') || errorName.includes('resource') || errorMessage.includes('limit')) {
      return {
        category: 'resource',
        severity: 'high',
        recoverable: true,
        retryable: false,
        escalatable: true
      }
    }
    
    // System errors
    if (errorName.includes('system') || errorName.includes('internal')) {
      return {
        category: 'system',
        severity: 'critical',
        recoverable: true,
        retryable: true,
        escalatable: true
      }
    }
    
    // Default classification for unknown errors
    return {
      category: 'unknown',
      severity: 'medium',
      recoverable: true,
      retryable: true,
      escalatable: false
    }
  }
}

// Recovery executor
class RecoveryExecutor {
  constructor(private config: RecoveryStrategyConfig) {}
  
  async executeAction(action: RecoveryAction, context: RecoveryContext): Promise<{
    success: boolean
    recoveryCompleted?: boolean
    error?: string
    metadata?: Record<string, any>
  }> {
    
    switch (action.type) {
      case 'retry':
        return this.executeRetry(action, context)
      case 'retry_with_fallback':
        return this.executeRetryWithFallback(action, context)
      case 'circuit_breaker':
        return this.executeCircuitBreaker(action, context)
      case 'resource_scaling':
        return this.executeResourceScaling(action, context)
      case 'failover':
        return this.executeFailover(action, context)
      case 'rollback':
        return this.executeRollback(action, context)
      case 'manual_intervention':
        return this.executeManualIntervention(action, context)
      case 'ignore':
        return this.executeIgnore(action, context)
      case 'terminate':
        return this.executeTerminate(action, context)
      case 'escalate':
        return this.executeEscalate(action, context)
      default:
        return {
          success: false,
          error: `Unknown recovery action type: ${action.type}`
        }
    }
  }
  
  private async executeRetry(action: RecoveryAction, context: RecoveryContext): Promise<any> {
    const { maxAttempts = 3, exponentialBackoff = true, backoffMultiplier = 2 } = action.parameters
    
    if (!context.originalContext) {
      return {
        success: false,
        error: 'Cannot retry: original execution context not available'
      }
    }
    
    try {
      // Schedule retry execution as background job
      const jobId = await addBackgroundJob('workflow_execution', context.originalContext, {
        priority: 'high',
        config: {
          timeout: 300000,
          maxRetries: maxAttempts,
          retryDelay: exponentialBackoff ? 1000 : 5000,
          concurrency: 1
        },
        metadata: {
          tags: ['retry'],
          childJobIds: [],
          isRetry: true,
          originalExecutionId: context.executionId,
          retryReason: context.error.message
        } as any
      })
      
      return {
        success: true,
        recoveryCompleted: true,
        metadata: {
          retryJobId: jobId,
          maxAttempts
        }
      }
    } catch (error) {
      return {
        success: false,
        error: `Retry scheduling failed: ${(error as Error).message}`
      }
    }
  }
  
  private async executeRetryWithFallback(action: RecoveryAction, context: RecoveryContext): Promise<any> {
    // Similar to retry but with modified configuration
    const { fallbackConfig } = action.parameters
    
    if (!context.originalContext || !fallbackConfig) {
      return {
        success: false,
        error: 'Cannot retry with fallback: missing context or fallback configuration'
      }
    }
    
    // Modify execution context with fallback configuration
    const fallbackContext = {
      ...context.originalContext,
      config: {
        ...context.originalContext.config,
        ...fallbackConfig
      }
    }
    
    try {
      const jobId = await addBackgroundJob('workflow_execution', fallbackContext, {
        priority: 'high',
        metadata: {
          tags: ['fallback-retry'],
          childJobIds: [],
          isFallbackRetry: true,
          originalExecutionId: context.executionId
        } as any
      })
      
      return {
        success: true,
        recoveryCompleted: true,
        metadata: { fallbackJobId: jobId }
      }
    } catch (error) {
      return {
        success: false,
        error: `Fallback retry failed: ${(error as Error).message}`
      }
    }
  }
  
  private async executeCircuitBreaker(action: RecoveryAction, context: RecoveryContext): Promise<any> {
    const { duration = 300000 } = action.parameters // 5 minutes default
    
    // This would implement circuit breaker logic
    // For now, just log the action
    logger.warn('Circuit breaker activated', {
      category: 'error_recovery',
      component: 'recovery-executor',
      executionId: context.executionId,
      metadata: { duration }
    })
    
    return {
      success: true,
      metadata: { circuitBreakerDuration: duration }
    }
  }
  
  private async executeResourceScaling(action: RecoveryAction, context: RecoveryContext): Promise<any> {
    const { scaleType, scaleFactor = 1.5, maxScale = 4 } = action.parameters
    
    // This would implement actual resource scaling
    // For now, just simulate the action
    logger.info('Resource scaling requested', {
      category: 'error_recovery',
      component: 'recovery-executor',
      executionId: context.executionId,
      metadata: { scaleType, scaleFactor, maxScale }
    })
    
    return {
      success: true,
      metadata: {
        scaleType,
        scaleFactor,
        requiresApproval: !action.autoExecute
      }
    }
  }
  
  private async executeFailover(action: RecoveryAction, context: RecoveryContext): Promise<any> {
    const { backupSystem, timeout = 60000 } = action.parameters
    
    logger.info('Failover initiated', {
      category: 'error_recovery',
      component: 'recovery-executor',
      executionId: context.executionId,
      metadata: { backupSystem, timeout }
    })
    
    return {
      success: true,
      metadata: { backupSystem, timeout }
    }
  }
  
  private async executeRollback(action: RecoveryAction, context: RecoveryContext): Promise<any> {
    const { checkpointId, preserveState = true } = action.parameters
    
    logger.info('Rollback initiated', {
      category: 'error_recovery',
      component: 'recovery-executor',
      executionId: context.executionId,
      metadata: { checkpointId, preserveState }
    })
    
    return {
      success: true,
      metadata: { checkpointId, preserveState }
    }
  }
  
  private async executeManualIntervention(action: RecoveryAction, context: RecoveryContext): Promise<any> {
    const { priority = 'medium', assignee, message } = action.parameters
    
    // Create manual intervention ticket
    logger.info('Manual intervention required', {
      category: 'error_recovery',
      component: 'recovery-executor',
      executionId: context.executionId,
      metadata: {
        priority,
        assignee,
        message,
        errorType: context.error.name
      }
    })
    
    // In a real system, this would create a ticket in a ticketing system
    return {
      success: true,
      metadata: {
        interventionRequired: true,
        priority,
        assignee: assignee || 'on-call'
      }
    }
  }
  
  private async executeIgnore(action: RecoveryAction, context: RecoveryContext): Promise<any> {
    const { logLevel = 'warn' } = action.parameters
    
    logger[logLevel as 'warn']('Error ignored by recovery action', {
      category: 'error_recovery',
      component: 'recovery-executor',
      executionId: context.executionId,
      metadata: {
        ignoredError: context.error.name,
        reason: 'Recovery action: ignore'
      }
    })
    
    return {
      success: true,
      recoveryCompleted: true,
      metadata: { ignored: true }
    }
  }
  
  private async executeTerminate(action: RecoveryAction, context: RecoveryContext): Promise<any> {
    const { reason = 'Terminated by recovery action' } = action.parameters
    
    logger.info('Execution terminated by recovery action', {
      category: 'error_recovery',
      component: 'recovery-executor',
      executionId: context.executionId,
      metadata: { reason }
    })
    
    // Cancel the execution if it's still running
    if (context.executionState?.status === 'running') {
      await executionEngine.cancelExecution(context.executionId, reason)
    }
    
    return {
      success: true,
      recoveryCompleted: true,
      metadata: { terminated: true, reason }
    }
  }
  
  private async executeEscalate(action: RecoveryAction, context: RecoveryContext): Promise<any> {
    const { level = 1, urgency = 'medium', channels = ['email'] } = action.parameters
    
    logger.error('Error escalated', new Error(context.error.message), {
      category: 'error_recovery',
      component: 'recovery-executor',
      executionId: context.executionId,
      metadata: {
        escalationLevel: level,
        urgency,
        channels,
        originalError: context.error.name
      }
    })
    
    // In a real system, this would send notifications through various channels
    return {
      success: true,
      metadata: {
        escalated: true,
        level,
        urgency,
        channels
      }
    }
  }
}

// Circuit breaker implementation
class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'
  
  constructor(
    private threshold: number,
    private cooldownMs: number
  ) {}
  
  allowRequest(): boolean {
    const now = Date.now()
    
    switch (this.state) {
      case 'closed':
        return true
      
      case 'open':
        if (now - this.lastFailureTime >= this.cooldownMs) {
          this.state = 'half-open'
          return true
        }
        return false
      
      case 'half-open':
        return true
      
      default:
        return false
    }
  }
  
  recordSuccess(): void {
    this.failures = 0
    this.state = 'closed'
  }
  
  recordFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    
    if (this.failures >= this.threshold) {
      this.state = 'open'
    }
  }
  
  getState(): string {
    return this.state
  }
  
  getFailureCount(): number {
    return this.failures
  }
  
  getNextAttemptTime(): number | null {
    if (this.state === 'open') {
      return this.lastFailureTime + this.cooldownMs
    }
    return null
  }
}

// Global error recovery system instance
export const errorRecoverySystem = new ErrorRecoverySystem()

// Utility functions
export const handleExecutionError = async (
  executionId: string,
  error: Error,
  context: {
    agentId?: string
    projectId?: string
    executionState?: ExecutionState
    originalContext?: ExecutionContext
    metadata?: Record<string, any>
  } = {}
): Promise<RecoveryContext> => {
  return errorRecoverySystem.handleError(executionId, error, context)
}

export const addRecoveryRule = (rule: RecoveryRule): void => {
  errorRecoverySystem.addRecoveryRule(rule)
}

export const getRecoveryStatistics = () => {
  return errorRecoverySystem.getRecoveryStatistics()
}

export const performRecoveryHealthCheck = async () => {
  return errorRecoverySystem.healthCheck()
}

export default {
  ErrorRecoverySystem,
  errorRecoverySystem,
  handleExecutionError,
  addRecoveryRule,
  getRecoveryStatistics,
  performRecoveryHealthCheck
}