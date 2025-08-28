// src/lib/audit-system.ts

import { z } from 'zod'
import { logger } from './logging-system'

// Audit event types for different system operations
export const AUDIT_EVENT_TYPES = {
  // Agent lifecycle events
  agent_created: 'agent_created',
  agent_updated: 'agent_updated',
  agent_deleted: 'agent_deleted',
  agent_activated: 'agent_activated',
  agent_deactivated: 'agent_deactivated',
  
  // Agent decision events
  agent_decision: 'agent_decision',
  agent_action: 'agent_action',
  agent_response: 'agent_response',
  agent_error: 'agent_error',
  
  // Configuration changes
  config_updated: 'config_updated',
  model_changed: 'model_changed',
  memory_config_changed: 'memory_config_changed',
  capability_modified: 'capability_modified',
  
  // Execution events
  execution_started: 'execution_started',
  execution_completed: 'execution_completed',
  execution_failed: 'execution_failed',
  execution_cancelled: 'execution_cancelled',
  
  // Project management
  project_created: 'project_created',
  project_updated: 'project_updated',
  project_deleted: 'project_deleted',
  project_archived: 'project_archived',
  
  // User actions
  user_login: 'user_login',
  user_logout: 'user_logout',
  user_permission_changed: 'user_permission_changed',
  
  // System events
  system_started: 'system_started',
  system_shutdown: 'system_shutdown',
  backup_created: 'backup_created',
  data_exported: 'data_exported',
  data_imported: 'data_imported',
  
  // Job management events
  job_created: 'job_created',
  job_completed: 'job_completed',
  job_failed: 'job_failed',
  job_cancelled: 'job_cancelled',
  job_retried: 'job_retried',
  
  // Recovery events
  recovery_started: 'recovery_started',
  recovery_completed: 'recovery_completed',
  recovery_failed: 'recovery_failed',
  
  // Security events
  unauthorized_access: 'unauthorized_access',
  permission_denied: 'permission_denied',
  suspicious_activity: 'suspicious_activity',
  security_policy_violation: 'security_policy_violation'
} as const

export type AuditEventType = keyof typeof AUDIT_EVENT_TYPES

// Audit entry schema
export const auditEntrySchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  
  // Event classification
  eventType: z.string(),
  category: z.enum(['agent', 'system', 'user', 'security', 'configuration', 'execution']),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  
  // Actor information
  actor: z.object({
    type: z.enum(['user', 'agent', 'system']),
    id: z.string(),
    name: z.string().optional(),
    role: z.string().optional(),
    sessionId: z.string().optional()
  }),
  
  // Target/subject of the audit event
  target: z.object({
    type: z.enum(['agent', 'project', 'execution', 'configuration', 'user', 'system']),
    id: z.string(),
    name: z.string().optional(),
    properties: z.record(z.string(), z.any()).optional()
  }).optional(),
  
  // Event details
  event: z.object({
    description: z.string(),
    action: z.string(),
    outcome: z.enum(['success', 'failure', 'partial', 'pending']),
    reason: z.string().optional()
  }),
  
  // Changes made (before/after states)
  changes: z.object({
    before: z.record(z.string(), z.any()).optional(),
    after: z.record(z.string(), z.any()).optional(),
    diff: z.array(z.object({
      path: z.string(),
      operation: z.enum(['add', 'remove', 'change']),
      oldValue: z.any().optional(),
      newValue: z.any().optional()
    })).optional()
  }).optional(),
  
  // Context information
  context: z.object({
    projectId: z.string().optional(),
    executionId: z.string().optional(),
    requestId: z.string().optional(),
    correlationId: z.string().optional(),
    userAgent: z.string().optional(),
    ipAddress: z.string().optional(),
    location: z.string().optional()
  }).optional(),
  
  // Decision-making context (for agent decisions)
  decisionContext: z.object({
    prompt: z.string().optional(),
    options: z.array(z.string()).optional(),
    reasoning: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
    alternatives: z.array(z.object({
      option: z.string(),
      score: z.number(),
      reason: z.string()
    })).optional()
  }).optional(),
  
  // Risk assessment
  risk: z.object({
    level: z.enum(['low', 'medium', 'high', 'critical']),
    factors: z.array(z.string()),
    mitigation: z.array(z.string()).optional(),
    impact: z.string().optional()
  }).optional(),
  
  // Compliance information
  compliance: z.object({
    regulations: z.array(z.string()).optional(), // e.g., ['GDPR', 'SOX', 'HIPAA']
    tags: z.array(z.string()).optional(),
    retentionPeriod: z.number().optional() // days
  }).optional(),
  
  // Metadata
  metadata: z.record(z.string(), z.any()).default({})
})

export type AuditEntry = z.infer<typeof auditEntrySchema>

// Audit configuration
export const auditConfigSchema = z.object({
  enabled: z.boolean().default(true),
  
  // Event filtering
  eventFiltering: z.object({
    enabledCategories: z.array(z.enum(['agent', 'system', 'user', 'security', 'configuration', 'execution'])).default([
      'agent', 'system', 'user', 'security', 'configuration', 'execution'
    ]),
    minSeverity: z.enum(['low', 'medium', 'high', 'critical']).default('low'),
    excludeEvents: z.array(z.string()).default([])
  }).default({
    enabledCategories: ['agent', 'system', 'user', 'security', 'configuration', 'execution'],
    minSeverity: 'low',
    excludeEvents: []
  }),
  
  // Storage settings
  storage: z.object({
    enableDatabase: z.boolean().default(true),
    enableFileBackup: z.boolean().default(true),
    compressionEnabled: z.boolean().default(true),
    encryptionEnabled: z.boolean().default(true),
    bufferSize: z.number().default(100),
    flushInterval: z.number().default(30000) // 30 seconds
  }).default({
    enableDatabase: true,
    enableFileBackup: true,
    compressionEnabled: true,
    encryptionEnabled: true,
    bufferSize: 100,
    flushInterval: 30000
  }),
  
  // Retention policy
  retention: z.object({
    defaultRetentionDays: z.number().default(2555), // 7 years
    categoryRetention: z.record(z.string(), z.number()).default({
      security: 2555,      // 7 years
      configuration: 1095, // 3 years
      agent: 365,          // 1 year
      execution: 90,       // 3 months
      system: 365,         // 1 year
      user: 365            // 1 year
    }),
    archiveAfterDays: z.number().default(365),
    purgeAfterDays: z.number().default(2555)
  }).default({
    defaultRetentionDays: 2555,
    categoryRetention: {
      security: 2555,
      configuration: 1095,
      agent: 365,
      execution: 90,
      system: 365,
      user: 365
    },
    archiveAfterDays: 365,
    purgeAfterDays: 2555
  }),
  
  // Real-time monitoring
  monitoring: z.object({
    enableRealTimeAlerts: z.boolean().default(true),
    alertThresholds: z.object({
      securityEventsPerHour: z.number().default(10),
      failureRateThreshold: z.number().default(0.1), // 10%
      suspiciousActivityThreshold: z.number().default(5)
    }).default({
      securityEventsPerHour: 10,
      failureRateThreshold: 0.1,
      suspiciousActivityThreshold: 5
    }),
    webhookUrl: z.string().optional(),
    notificationChannels: z.array(z.string()).default([])
  }).default({
    enableRealTimeAlerts: true,
    alertThresholds: {
      securityEventsPerHour: 10,
      failureRateThreshold: 0.1,
      suspiciousActivityThreshold: 5
    },
    notificationChannels: []
  })
})

export type AuditConfig = z.infer<typeof auditConfigSchema>

// Audit system class
export class AuditSystem {
  private config: AuditConfig
  private buffer: AuditEntry[] = []
  private flushTimer: NodeJS.Timeout | null = null
  
  constructor(config: Partial<AuditConfig> = {}) {
    this.config = auditConfigSchema.parse(config)
    
    if (this.config.enabled) {
      this.startFlushTimer()
    }
  }
  
  // Record an audit event
  audit(
    eventType: AuditEventType,
    actor: AuditEntry['actor'],
    event: AuditEntry['event'],
    options: {
      target?: AuditEntry['target']
      category?: AuditEntry['category']
      severity?: AuditEntry['severity']
      changes?: AuditEntry['changes']
      context?: AuditEntry['context']
      decisionContext?: AuditEntry['decisionContext']
      risk?: AuditEntry['risk']
      compliance?: AuditEntry['compliance']
      metadata?: Record<string, any>
    } = {}
  ): AuditEntry | null {
    
    if (!this.config.enabled) {
      return null
    }
    
    const category = options.category || this.inferCategory(eventType)
    const severity = options.severity || this.inferSeverity(eventType)
    
    // Check if this event should be recorded
    if (!this.shouldRecord(eventType, category, severity)) {
      return null
    }
    
    const auditEntry: AuditEntry = {
      id: this.generateId(),
      timestamp: Date.now(),
      eventType,
      category,
      severity,
      actor,
      target: options.target,
      event,
      changes: options.changes,
      context: options.context,
      decisionContext: options.decisionContext,
      risk: options.risk,
      compliance: this.addComplianceInfo(eventType, options.compliance),
      metadata: options.metadata || {}
    }
    
    // Store the audit entry
    this.store(auditEntry)
    
    // Check for real-time alerts
    this.checkAlerts(auditEntry)
    
    // Log to the main logging system
    logger.info(`Audit: ${auditEntry.event.description}`, {
      category: 'audit_trail',
      component: 'audit-system',
      agentId: actor.type === 'agent' ? actor.id : undefined,
      userId: actor.type === 'user' ? actor.id : undefined,
      metadata: {
        eventType,
        outcome: event.outcome,
        severity,
        targetType: options.target?.type,
        targetId: options.target?.id
      }
    })
    
    return auditEntry
  }
  
  // Specialized audit methods for common scenarios
  auditAgentDecision(
    agentId: string,
    decision: string,
    reasoning: string,
    options: {
      confidence?: number
      alternatives?: Array<{ option: string; score: number; reason: string }>
      executionId?: string
      projectId?: string
      prompt?: string
    } = {}
  ): AuditEntry | null {
    
    return this.audit('agent_decision', {
      type: 'agent',
      id: agentId,
      name: `Agent ${agentId}`
    }, {
      description: `Agent made decision: ${decision}`,
      action: 'decision',
      outcome: 'success'
    }, {
      category: 'agent',
      severity: 'medium',
      decisionContext: {
        prompt: options.prompt,
        reasoning,
        confidence: options.confidence,
        alternatives: options.alternatives
      },
      context: {
        executionId: options.executionId,
        projectId: options.projectId
      }
    })
  }
  
  auditConfigurationChange(
    userId: string,
    targetType: 'agent' | 'project' | 'system',
    targetId: string,
    changes: AuditEntry['changes'],
    reason?: string
  ): AuditEntry | null {
    
    return this.audit('config_updated', {
      type: 'user',
      id: userId
    }, {
      description: `Configuration updated for ${targetType} ${targetId}`,
      action: 'update',
      outcome: 'success',
      reason
    }, {
      category: 'configuration',
      severity: 'medium',
      target: {
        type: targetType,
        id: targetId
      },
      changes,
      risk: this.assessConfigurationRisk(changes)
    })
  }
  
  auditExecutionEvent(
    agentId: string,
    executionId: string,
    eventType: 'execution_started' | 'execution_completed' | 'execution_failed' | 'execution_cancelled',
    outcome: AuditEntry['event']['outcome'],
    metadata: Record<string, any> = {}
  ): AuditEntry | null {
    
    return this.audit(eventType, {
      type: 'agent',
      id: agentId
    }, {
      description: `Execution ${executionId} ${eventType.replace('execution_', '')}`,
      action: eventType.replace('execution_', ''),
      outcome
    }, {
      category: 'execution',
      severity: outcome === 'failure' ? 'high' : 'low',
      target: {
        type: 'execution',
        id: executionId
      },
      context: {
        executionId,
        projectId: metadata.projectId
      },
      metadata
    })
  }
  
  auditSecurityEvent(
    eventType: 'unauthorized_access' | 'permission_denied' | 'suspicious_activity',
    userId: string | null,
    description: string,
    context: {
      ipAddress?: string
      userAgent?: string
      location?: string
      resource?: string
      action?: string
    } = {}
  ): AuditEntry | null {
    
    return this.audit(eventType, {
      type: userId ? 'user' : 'system',
      id: userId || 'system'
    }, {
      description,
      action: eventType,
      outcome: 'failure'
    }, {
      category: 'security',
      severity: 'critical',
      context: {
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        location: context.location
      },
      risk: {
        level: 'high',
        factors: ['security_violation', 'unauthorized_access'],
        impact: 'Potential security breach'
      },
      metadata: {
        resource: context.resource,
        attemptedAction: context.action
      }
    })
  }
  
  // Search and query audit entries
  async searchAuditLog(
    filters: {
      startTime?: number
      endTime?: number
      eventTypes?: AuditEventType[]
      categories?: AuditEntry['category'][]
      actors?: string[]
      targets?: string[]
      severity?: AuditEntry['severity'][]
      outcome?: AuditEntry['event']['outcome'][]
      projectId?: string
      executionId?: string
      searchText?: string
    } = {},
    options: {
      limit?: number
      offset?: number
      sortBy?: 'timestamp' | 'severity'
      sortOrder?: 'asc' | 'desc'
    } = {}
  ): Promise<{
    entries: AuditEntry[]
    total: number
    hasMore: boolean
  }> {
    
    // In a real implementation, this would query the database
    // For now, filter the buffer (limited functionality)
    let filtered = [...this.buffer]
    
    if (filters.startTime) {
      filtered = filtered.filter(entry => entry.timestamp >= filters.startTime!)
    }
    
    if (filters.endTime) {
      filtered = filtered.filter(entry => entry.timestamp <= filters.endTime!)
    }
    
    if (filters.eventTypes?.length) {
      filtered = filtered.filter(entry => filters.eventTypes!.includes(entry.eventType as AuditEventType))
    }
    
    if (filters.categories?.length) {
      filtered = filtered.filter(entry => filters.categories!.includes(entry.category))
    }
    
    if (filters.actors?.length) {
      filtered = filtered.filter(entry => filters.actors!.includes(entry.actor.id))
    }
    
    if (filters.severity?.length) {
      filtered = filtered.filter(entry => filters.severity!.includes(entry.severity))
    }
    
    if (filters.searchText) {
      const searchLower = filters.searchText.toLowerCase()
      filtered = filtered.filter(entry => 
        entry.event.description.toLowerCase().includes(searchLower) ||
        entry.eventType.toLowerCase().includes(searchLower)
      )
    }
    
    // Sort
    const sortBy = options.sortBy || 'timestamp'
    const sortOrder = options.sortOrder || 'desc'
    
    filtered.sort((a, b) => {
      const aVal = sortBy === 'timestamp' ? a.timestamp : this.getSeverityWeight(a.severity)
      const bVal = sortBy === 'timestamp' ? b.timestamp : this.getSeverityWeight(b.severity)
      
      return sortOrder === 'asc' ? aVal - bVal : bVal - aVal
    })
    
    // Pagination
    const limit = options.limit || 100
    const offset = options.offset || 0
    const paged = filtered.slice(offset, offset + limit)
    
    return {
      entries: paged,
      total: filtered.length,
      hasMore: offset + limit < filtered.length
    }
  }
  
  // Generate compliance reports
  async generateComplianceReport(
    regulation: string,
    startTime: number,
    endTime: number
  ): Promise<{
    regulation: string
    period: { start: number; end: number }
    summary: {
      totalEvents: number
      eventsByCategory: Record<string, number>
      criticalEvents: number
      complianceScore: number
    }
    events: AuditEntry[]
    violations: Array<{
      event: AuditEntry
      violation: string
      severity: 'low' | 'medium' | 'high' | 'critical'
    }>
  }> {
    
    const relevantEntries = this.buffer.filter(entry => 
      entry.timestamp >= startTime && 
      entry.timestamp <= endTime &&
      entry.compliance?.regulations?.includes(regulation)
    )
    
    const eventsByCategory = relevantEntries.reduce((acc, entry) => {
      acc[entry.category] = (acc[entry.category] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    
    const criticalEvents = relevantEntries.filter(entry => entry.severity === 'critical').length
    
    // Simple compliance score calculation
    const totalEvents = relevantEntries.length
    const complianceScore = totalEvents > 0 ? Math.max(0, 1 - (criticalEvents / totalEvents)) : 1
    
    return {
      regulation,
      period: { start: startTime, end: endTime },
      summary: {
        totalEvents,
        eventsByCategory,
        criticalEvents,
        complianceScore
      },
      events: relevantEntries,
      violations: [] // TODO: Implement violation detection
    }
  }
  
  // Private helper methods
  private shouldRecord(eventType: AuditEventType, category: AuditEntry['category'], severity: AuditEntry['severity']): boolean {
    // Check category filter
    if (!this.config.eventFiltering.enabledCategories.includes(category)) {
      return false
    }
    
    // Check severity filter
    const minSeverityWeight = this.getSeverityWeight(this.config.eventFiltering.minSeverity)
    const eventSeverityWeight = this.getSeverityWeight(severity)
    if (eventSeverityWeight < minSeverityWeight) {
      return false
    }
    
    // Check excluded events
    if (this.config.eventFiltering.excludeEvents.includes(eventType)) {
      return false
    }
    
    return true
  }
  
  private inferCategory(eventType: AuditEventType): AuditEntry['category'] {
    if (eventType.startsWith('agent_')) return 'agent'
    if (eventType.startsWith('user_')) return 'user'
    if (eventType.startsWith('execution_')) return 'execution'
    if (eventType.startsWith('config_') || eventType.includes('_config_')) return 'configuration'
    if (eventType.includes('unauthorized') || eventType.includes('security')) return 'security'
    return 'system'
  }
  
  private inferSeverity(eventType: AuditEventType): AuditEntry['severity'] {
    if (eventType.includes('security') || eventType.includes('unauthorized')) return 'critical'
    if (eventType.includes('error') || eventType.includes('failed')) return 'high'
    if (eventType.includes('decision') || eventType.includes('updated')) return 'medium'
    return 'low'
  }
  
  private getSeverityWeight(severity: AuditEntry['severity']): number {
    const weights = { low: 1, medium: 2, high: 3, critical: 4 }
    return weights[severity]
  }
  
  private addComplianceInfo(eventType: AuditEventType, existing?: AuditEntry['compliance']): AuditEntry['compliance'] {
    const baseCompliance: AuditEntry['compliance'] = {
      regulations: [],
      tags: [],
      ...existing
    }
    
    // Add default compliance tags based on event type
    if (eventType.includes('security') || eventType.includes('unauthorized')) {
      baseCompliance.regulations?.push('SOX', 'GDPR')
      baseCompliance.tags?.push('security_critical')
      baseCompliance.retentionPeriod = 2555 // 7 years
    }
    
    if (eventType.includes('user_')) {
      baseCompliance.regulations?.push('GDPR')
      baseCompliance.tags?.push('personal_data')
    }
    
    return baseCompliance
  }
  
  private assessConfigurationRisk(changes?: AuditEntry['changes']): AuditEntry['risk'] {
    if (!changes?.diff) {
      return {
        level: 'low',
        factors: ['configuration_change']
      }
    }
    
    const riskFactors = []
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    
    for (const change of changes.diff) {
      if (change.path.includes('security') || change.path.includes('auth')) {
        riskFactors.push('security_configuration')
        riskLevel = 'high'
      }
      if (change.path.includes('model') || change.path.includes('capability')) {
        riskFactors.push('behavioral_change')
        if (riskLevel === 'low') riskLevel = 'medium'
      }
    }
    
    return {
      level: riskLevel,
      factors: riskFactors.length > 0 ? riskFactors : ['configuration_change']
    }
  }
  
  private store(entry: AuditEntry): void {
    this.buffer.push(entry)
    
    if (this.buffer.length >= this.config.storage.bufferSize) {
      this.flush().catch(error => {
        logger.error('Failed to flush audit buffer', error as Error, {
          component: 'audit-system'
        })
      })
    }
  }
  
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return
    
    const batch = this.buffer.splice(0, this.config.storage.bufferSize)
    
    try {
      if (this.config.storage.enableDatabase) {
        await this.saveToDatabase(batch)
      }
      
      if (this.config.storage.enableFileBackup) {
        await this.saveToFile(batch)
      }
    } catch (error) {
      // On error, put entries back in buffer
      this.buffer.unshift(...batch)
      throw error
    }
  }
  
  private async saveToDatabase(entries: AuditEntry[]): Promise<void> {
    // TODO: Implement Convex database save
    logger.debug(`Saving ${entries.length} audit entries to database`)
  }
  
  private async saveToFile(entries: AuditEntry[]): Promise<void> {
    // TODO: Implement file backup
    logger.debug(`Backing up ${entries.length} audit entries to file`)
  }
  
  private checkAlerts(entry: AuditEntry): void {
    if (!this.config.monitoring.enableRealTimeAlerts) return
    
    // Check for security events
    if (entry.category === 'security') {
      const recentSecurityEvents = this.buffer.filter(e => 
        e.category === 'security' && 
        e.timestamp > Date.now() - 3600000 // 1 hour
      ).length
      
      if (recentSecurityEvents > this.config.monitoring.alertThresholds.securityEventsPerHour) {
        this.sendAlert('Security event threshold exceeded', entry)
      }
    }
    
    // Check for suspicious activity
    if (entry.eventType === 'suspicious_activity') {
      this.sendAlert('Suspicious activity detected', entry)
    }
  }
  
  private sendAlert(message: string, entry: AuditEntry): void {
    logger.warn(message, {
      category: 'monitoring_alert',
      component: 'audit-system',
      metadata: {
        auditEntryId: entry.id,
        eventType: entry.eventType,
        severity: entry.severity,
        actor: entry.actor.id
      }
    })
    
    // TODO: Implement webhook notifications
    // TODO: Implement other notification channels
  }
  
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(error => {
        logger.error('Scheduled audit flush failed', error as Error, {
          component: 'audit-system'
        })
      })
    }, this.config.storage.flushInterval)
  }
  
  private generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }
  
  async close(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    await this.flush()
  }
}

// Global audit system instance
export const auditSystem = new AuditSystem()

// Utility functions for common audit patterns
export const auditAgentAction = (
  agentId: string,
  action: string,
  outcome: AuditEntry['event']['outcome'],
  metadata: Record<string, any> = {}
): AuditEntry | null => {
  
  return auditSystem.audit('agent_action', {
    type: 'agent',
    id: agentId
  }, {
    description: `Agent performed action: ${action}`,
    action,
    outcome
  }, {
    category: 'agent',
    severity: outcome === 'failure' ? 'medium' : 'low',
    metadata
  })
}

export const auditUserAction = (
  userId: string,
  action: string,
  targetType: 'agent' | 'project' | 'execution' | 'configuration' | 'user' | 'system',
  targetId: string,
  outcome: AuditEntry['event']['outcome'] = 'success',
  context?: AuditEntry['context']
): AuditEntry | null => {
  
  return auditSystem.audit('user_action' as AuditEventType, {
    type: 'user',
    id: userId
  }, {
    description: `User ${action} ${targetType} ${targetId}`,
    action,
    outcome
  }, {
    category: 'user',
    severity: 'low',
    target: {
      type: targetType,
      id: targetId
    },
    context
  })
}

export const createAuditTrail = (
  category: AuditEntry['category']
): Pick<AuditSystem, 'audit' | 'auditAgentDecision' | 'auditConfigurationChange' | 'auditExecutionEvent' | 'auditSecurityEvent'> => {
  return {
    audit: auditSystem.audit.bind(auditSystem),
    auditAgentDecision: auditSystem.auditAgentDecision.bind(auditSystem),
    auditConfigurationChange: auditSystem.auditConfigurationChange.bind(auditSystem),
    auditExecutionEvent: auditSystem.auditExecutionEvent.bind(auditSystem),
    auditSecurityEvent: auditSystem.auditSecurityEvent.bind(auditSystem)
  }
}