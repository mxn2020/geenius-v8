// src/lib/realtime-monitoring.ts

import { z } from 'zod'
import { logger } from './logging-system'
import { performanceCollector, type ExecutionPerformance } from './performance-metrics'
import { tokenTracker, type TokenUsage } from './token-tracking'
import { auditSystem, type AuditEntry } from './audit-system'

// Real-time monitoring event types
export const MONITORING_EVENT_TYPES = {
  // Agent status events
  agent_status_changed: 'agent_status_changed',
  agent_heartbeat: 'agent_heartbeat',
  agent_resource_alert: 'agent_resource_alert',
  
  // Execution events
  execution_started: 'execution_started',
  execution_progress: 'execution_progress',
  execution_completed: 'execution_completed',
  execution_error: 'execution_error',
  execution_timeout: 'execution_timeout',
  
  // System health events
  system_health_check: 'system_health_check',
  resource_threshold_exceeded: 'resource_threshold_exceeded',
  performance_degradation: 'performance_degradation',
  
  // Alert events
  threshold_breach: 'threshold_breach',
  anomaly_detected: 'anomaly_detected',
  sla_violation: 'sla_violation'
} as const

export type MonitoringEventType = keyof typeof MONITORING_EVENT_TYPES

// Agent status schema
export const agentStatusSchema = z.object({
  agentId: z.string(),
  status: z.enum(['idle', 'active', 'busy', 'paused', 'error', 'offline']),
  lastHeartbeat: z.number(),
  currentExecution: z.string().optional(),
  
  // Resource usage
  resources: z.object({
    memoryUsage: z.number().optional(), // bytes
    cpuUsage: z.number().optional(),    // percentage 0-1
    activeConnections: z.number().default(0),
    queuedTasks: z.number().default(0)
  }).default({
    activeConnections: 0,
    queuedTasks: 0
  }),
  
  // Performance metrics
  performance: z.object({
    successRate: z.number().min(0).max(1),
    avgExecutionTime: z.number(),
    errorCount: z.number().default(0),
    lastExecutionTime: z.number().optional()
  }),
  
  // Cost tracking
  costs: z.object({
    totalCost: z.number().default(0),
    hourlyRate: z.number().default(0),
    tokenUsage: z.number().default(0)
  }).default({
    totalCost: 0,
    hourlyRate: 0,
    tokenUsage: 0
  }),
  
  metadata: z.record(z.string(), z.any()).default({})
})

export type AgentStatus = z.infer<typeof agentStatusSchema>

// Execution monitoring schema
export const executionMonitoringSchema = z.object({
  executionId: z.string(),
  agentId: z.string(),
  projectId: z.string(),
  status: z.enum(['queued', 'running', 'completed', 'failed', 'cancelled', 'timeout']),
  
  // Timing information
  timing: z.object({
    queuedAt: z.number(),
    startedAt: z.number().optional(),
    completedAt: z.number().optional(),
    estimatedDuration: z.number().optional(),
    actualDuration: z.number().optional()
  }),
  
  // Progress tracking
  progress: z.object({
    percentage: z.number().min(0).max(1),
    currentPhase: z.string().optional(),
    phases: z.array(z.object({
      name: z.string(),
      status: z.enum(['pending', 'active', 'completed', 'failed']),
      progress: z.number().min(0).max(1),
      startTime: z.number().optional(),
      endTime: z.number().optional()
    })).default([])
  }),
  
  // Resource consumption
  resources: z.object({
    tokensUsed: z.number().default(0),
    costIncurred: z.number().default(0),
    memoryPeak: z.number().optional(),
    apiCalls: z.number().default(0)
  }).default({
    tokensUsed: 0,
    costIncurred: 0,
    apiCalls: 0
  }),
  
  // Error tracking
  errors: z.array(z.object({
    timestamp: z.number(),
    type: z.string(),
    message: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    recoverable: z.boolean()
  })).default([]),
  
  metadata: z.record(z.string(), z.any()).default({})
})

export type ExecutionMonitoring = z.infer<typeof executionMonitoringSchema>

// System health schema
export const systemHealthSchema = z.object({
  timestamp: z.number(),
  overall: z.enum(['healthy', 'degraded', 'critical', 'offline']),
  
  // Component health
  components: z.record(z.string(), z.object({
    status: z.enum(['healthy', 'degraded', 'critical', 'offline']),
    lastCheck: z.number(),
    responseTime: z.number().optional(),
    errorRate: z.number().min(0).max(1).optional(),
    details: z.string().optional()
  })),
  
  // Resource metrics
  resources: z.object({
    memoryUsage: z.object({
      used: z.number(),
      total: z.number(),
      percentage: z.number().min(0).max(1)
    }),
    cpuUsage: z.object({
      current: z.number().min(0).max(1),
      average: z.number().min(0).max(1)
    }),
    diskUsage: z.object({
      used: z.number(),
      total: z.number(),
      percentage: z.number().min(0).max(1)
    }).optional()
  }),
  
  // Service metrics
  services: z.object({
    activeAgents: z.number(),
    runningExecutions: z.number(),
    queuedExecutions: z.number(),
    requestsPerMinute: z.number(),
    avgResponseTime: z.number()
  }),
  
  metadata: z.record(z.string(), z.any()).default({})
})

export type SystemHealth = z.infer<typeof systemHealthSchema>

// Monitoring configuration
export const monitoringConfigSchema = z.object({
  enabled: z.boolean().default(true),
  
  // Real-time updates
  realTime: z.object({
    enableWebSockets: z.boolean().default(true),
    enableServerSentEvents: z.boolean().default(true),
    updateInterval: z.number().default(1000), // 1 second
    maxConnections: z.number().default(100)
  }).default({
    enableWebSockets: true,
    enableServerSentEvents: true,
    updateInterval: 1000,
    maxConnections: 100
  }),
  
  // Health checking
  healthChecks: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().default(30000), // 30 seconds
    timeout: z.number().default(5000),   // 5 seconds
    retryCount: z.number().default(3),
    endpoints: z.array(z.string()).default([])
  }).default({
    enabled: true,
    interval: 30000,
    timeout: 5000,
    retryCount: 3,
    endpoints: []
  }),
  
  // Alerting thresholds
  thresholds: z.object({
    agent: z.object({
      maxIdleTime: z.number().default(300000),        // 5 minutes
      maxExecutionTime: z.number().default(1800000),  // 30 minutes
      maxErrorRate: z.number().default(0.1),          // 10%
      maxMemoryUsage: z.number().default(0.8)         // 80%
    }).default({
      maxIdleTime: 300000,
      maxExecutionTime: 1800000,
      maxErrorRate: 0.1,
      maxMemoryUsage: 0.8
    }),
    system: z.object({
      maxCpuUsage: z.number().default(0.8),           // 80%
      maxMemoryUsage: z.number().default(0.8),        // 80%
      maxDiskUsage: z.number().default(0.9),          // 90%
      maxResponseTime: z.number().default(5000),      // 5 seconds
      maxErrorRate: z.number().default(0.05)          // 5%
    }).default({
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.8,
      maxDiskUsage: 0.9,
      maxResponseTime: 5000,
      maxErrorRate: 0.05
    }),
    cost: z.object({
      hourlyLimit: z.number().default(50),            // $50/hour
      dailyLimit: z.number().default(500),            // $500/day
      tokenRateLimit: z.number().default(100000)      // 100k tokens/hour
    }).default({
      hourlyLimit: 50,
      dailyLimit: 500,
      tokenRateLimit: 100000
    })
  }).default({
    agent: {
      maxIdleTime: 300000,
      maxExecutionTime: 1800000,
      maxErrorRate: 0.1,
      maxMemoryUsage: 0.8
    },
    system: {
      maxCpuUsage: 0.8,
      maxMemoryUsage: 0.8,
      maxDiskUsage: 0.9,
      maxResponseTime: 5000,
      maxErrorRate: 0.05
    },
    cost: {
      hourlyLimit: 50,
      dailyLimit: 500,
      tokenRateLimit: 100000
    }
  }),
  
  // Data retention
  retention: z.object({
    realtimeDataHours: z.number().default(24),
    historicalDataDays: z.number().default(30),
    alertHistoryDays: z.number().default(90)
  }).default({
    realtimeDataHours: 24,
    historicalDataDays: 30,
    alertHistoryDays: 90
  })
})

export type MonitoringConfig = z.infer<typeof monitoringConfigSchema>

// Event listeners interface
export interface MonitoringEventListener {
  onAgentStatusChanged?(status: AgentStatus): void
  onExecutionUpdate?(execution: ExecutionMonitoring): void
  onSystemHealthUpdate?(health: SystemHealth): void
  onAlert?(alert: MonitoringAlert): void
}

// Monitoring alert schema
export const monitoringAlertSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  type: z.enum(['threshold', 'anomaly', 'sla_violation', 'system_error']),
  severity: z.enum(['info', 'warning', 'error', 'critical']),
  
  // Alert details
  title: z.string(),
  description: z.string(),
  source: z.string(), // component that generated the alert
  
  // Context
  agentId: z.string().optional(),
  executionId: z.string().optional(),
  projectId: z.string().optional(),
  
  // Threshold information (for threshold alerts)
  threshold: z.object({
    metric: z.string(),
    value: z.number(),
    limit: z.number(),
    operator: z.enum(['>', '<', '>=', '<=', '==', '!='])
  }).optional(),
  
  // Resolution
  resolved: z.boolean().default(false),
  resolvedAt: z.number().optional(),
  resolvedBy: z.string().optional(),
  
  metadata: z.record(z.string(), z.any()).default({})
})

export type MonitoringAlert = z.infer<typeof monitoringAlertSchema>

// Real-time monitoring system
export class RealtimeMonitor {
  private config: MonitoringConfig
  private listeners: MonitoringEventListener[] = []
  private agentStatuses = new Map<string, AgentStatus>()
  private executions = new Map<string, ExecutionMonitoring>()
  private systemHealth: SystemHealth | null = null
  private activeAlerts = new Map<string, MonitoringAlert>()
  
  // Timers for periodic tasks
  private healthCheckTimer: NodeJS.Timeout | null = null
  private cleanupTimer: NodeJS.Timeout | null = null
  
  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = monitoringConfigSchema.parse(config)
    
    if (this.config.enabled) {
      this.start()
    }
  }
  
  // Start monitoring services
  private start(): void {
    // Start health checks
    if (this.config.healthChecks.enabled) {
      this.startHealthChecks()
    }
    
    // Start cleanup timer
    this.startCleanupTimer()
    
    // Initialize system health
    this.updateSystemHealth()
    
    logger.info('Real-time monitoring started', {
      category: 'system_startup',
      component: 'realtime-monitor'
    })
  }
  
  // Agent monitoring
  updateAgentStatus(agentId: string, updates: Partial<AgentStatus>): void {
    const current = this.agentStatuses.get(agentId)
    const updated: AgentStatus = {
      ...current,
      ...updates,
      agentId,
      lastHeartbeat: Date.now()
    } as AgentStatus
    
    this.agentStatuses.set(agentId, updated)
    
    // Check for agent-specific alerts
    this.checkAgentAlerts(updated)
    
    // Notify listeners
    this.notifyListeners(listener => listener.onAgentStatusChanged?.(updated))
    
    logger.debug('Agent status updated', {
      category: 'agent_lifecycle',
      component: 'realtime-monitor',
      agentId,
      metadata: {
        status: updated.status,
        currentExecution: updated.currentExecution
      }
    })
  }
  
  recordAgentHeartbeat(agentId: string, metadata: Record<string, any> = {}): void {
    const current = this.agentStatuses.get(agentId)
    if (current) {
      this.updateAgentStatus(agentId, {
        lastHeartbeat: Date.now(),
        metadata: { ...current.metadata, ...metadata }
      })
    }
  }
  
  // Execution monitoring
  startExecutionMonitoring(
    executionId: string,
    agentId: string,
    projectId: string,
    estimatedDuration?: number
  ): void {
    
    const execution: ExecutionMonitoring = {
      executionId,
      agentId,
      projectId,
      status: 'queued',
      timing: {
        queuedAt: Date.now(),
        estimatedDuration
      },
      progress: {
        percentage: 0,
        phases: []
      },
      resources: {
        tokensUsed: 0,
        costIncurred: 0,
        apiCalls: 0
      },
      errors: [],
      metadata: {}
    }
    
    this.executions.set(executionId, execution)
    
    // Update agent status
    this.updateAgentStatus(agentId, {
      currentExecution: executionId,
      status: 'active'
    })
    
    this.notifyListeners(listener => listener.onExecutionUpdate?.(execution))
    
    logger.info('Execution monitoring started', {
      category: 'execution',
      component: 'realtime-monitor',
      executionId,
      agentId,
      metadata: { projectId, estimatedDuration }
    })
  }
  
  updateExecutionProgress(
    executionId: string,
    updates: Partial<Pick<ExecutionMonitoring, 'status' | 'progress' | 'resources' | 'errors'>>
  ): void {
    
    const execution = this.executions.get(executionId)
    if (!execution) return
    
    const updated = { ...execution, ...updates }
    
    // Update timing based on status changes
    if (updates.status && updates.status !== execution.status) {
      const now = Date.now()
      
      switch (updates.status) {
        case 'running':
          updated.timing.startedAt = now
          break
        case 'completed':
        case 'failed':
        case 'cancelled':
        case 'timeout':
          updated.timing.completedAt = now
          if (updated.timing.startedAt) {
            updated.timing.actualDuration = now - updated.timing.startedAt
          }
          break
      }
    }
    
    this.executions.set(executionId, updated)
    
    // Check for execution-specific alerts
    this.checkExecutionAlerts(updated)
    
    // Update agent status if execution completed
    if (['completed', 'failed', 'cancelled', 'timeout'].includes(updated.status)) {
      const agentStatus = this.agentStatuses.get(execution.agentId)
      if (agentStatus?.currentExecution === executionId) {
        this.updateAgentStatus(execution.agentId, {
          currentExecution: undefined,
          status: 'idle'
        })
      }
    }
    
    this.notifyListeners(listener => listener.onExecutionUpdate?.(updated))
    
    logger.debug('Execution progress updated', {
      category: 'execution',
      component: 'realtime-monitor',
      executionId,
      agentId: execution.agentId,
      metadata: {
        status: updated.status,
        progress: updated.progress.percentage,
        tokensUsed: updated.resources.tokensUsed
      }
    })
  }
  
  completeExecutionMonitoring(
    executionId: string,
    performance: ExecutionPerformance,
    tokenUsage?: TokenUsage
  ): void {
    
    const execution = this.executions.get(executionId)
    if (!execution) return
    
    this.updateExecutionProgress(executionId, {
      status: performance.quality.successRate > 0 ? 'completed' : 'failed',
      progress: { ...execution.progress, percentage: 1 },
      resources: {
        ...execution.resources,
        tokensUsed: tokenUsage?.tokens.total || 0,
        costIncurred: tokenUsage?.costs.total || 0
      }
    })
    
    // Update agent performance metrics
    const agentStatus = this.agentStatuses.get(execution.agentId)
    if (agentStatus) {
      this.updateAgentStatus(execution.agentId, {
        performance: {
          ...agentStatus.performance,
          lastExecutionTime: performance.timing.duration,
          successRate: performance.quality.successRate
        },
        costs: {
          ...agentStatus.costs,
          totalCost: agentStatus.costs.totalCost + (tokenUsage?.costs.total || 0),
          tokenUsage: agentStatus.costs.tokenUsage + (tokenUsage?.tokens.total || 0)
        }
      })
    }
    
    logger.info('Execution monitoring completed', {
      category: 'execution',
      component: 'realtime-monitor',
      executionId,
      agentId: execution.agentId,
      metadata: {
        duration: performance.timing.duration,
        success: performance.quality.successRate > 0,
        tokenCount: tokenUsage?.tokens.total || 0,
        cost: tokenUsage?.costs.total || 0
      },
      performance: {
        duration: performance.timing.duration,
        tokenCount: tokenUsage?.tokens.total || 0,
        cost: tokenUsage?.costs.total || 0
      }
    })
  }
  
  // System health monitoring
  private async updateSystemHealth(): Promise<void> {
    const now = Date.now()
    
    // Gather system metrics
    const memoryUsage = this.getMemoryUsage()
    const cpuUsage = this.getCpuUsage()
    
    // Check component health
    const components: SystemHealth['components'] = {}
    
    // Database health
    components.database = await this.checkDatabaseHealth()
    
    // Agent health summary
    const activeAgents = Array.from(this.agentStatuses.values()).filter(a => 
      a.status !== 'offline' && (now - a.lastHeartbeat) < 60000 // 1 minute
    ).length
    
    components.agents = {
      status: activeAgents > 0 ? 'healthy' : 'degraded',
      lastCheck: now,
      details: `${activeAgents} active agents`
    }
    
    // Calculate overall health
    const componentStatuses = Object.values(components).map(c => c.status)
    const overall = this.calculateOverallHealth(componentStatuses)
    
    const health: SystemHealth = {
      timestamp: now,
      overall,
      components,
      resources: {
        memoryUsage,
        cpuUsage: {
          current: cpuUsage,
          average: cpuUsage // Would maintain rolling average in real implementation
        }
      },
      services: {
        activeAgents,
        runningExecutions: Array.from(this.executions.values()).filter(e => e.status === 'running').length,
        queuedExecutions: Array.from(this.executions.values()).filter(e => e.status === 'queued').length,
        requestsPerMinute: 0, // Would calculate from recent metrics
        avgResponseTime: 0    // Would calculate from recent metrics
      },
      metadata: {}
    }
    
    this.systemHealth = health
    
    // Check system-level alerts
    this.checkSystemAlerts(health)
    
    this.notifyListeners(listener => listener.onSystemHealthUpdate?.(health))
  }
  
  // Alert management
  private createAlert(
    type: MonitoringAlert['type'],
    severity: MonitoringAlert['severity'],
    title: string,
    description: string,
    source: string,
    context: {
      agentId?: string
      executionId?: string
      projectId?: string
      threshold?: MonitoringAlert['threshold']
      metadata?: Record<string, any>
    } = {}
  ): MonitoringAlert {
    
    const alert: MonitoringAlert = {
      id: this.generateAlertId(),
      timestamp: Date.now(),
      type,
      severity,
      title,
      description,
      source,
      agentId: context.agentId,
      executionId: context.executionId,
      projectId: context.projectId,
      threshold: context.threshold,
      resolved: false,
      metadata: context.metadata || {}
    }
    
    this.activeAlerts.set(alert.id, alert)
    
    // Log the alert
    logger.warn(title, {
      category: 'monitoring_alert',
      component: 'realtime-monitor',
      agentId: context.agentId,
      executionId: context.executionId,
      metadata: {
        alertId: alert.id,
        severity,
        type,
        source
      }
    })
    
    this.notifyListeners(listener => listener.onAlert?.(alert))
    
    return alert
  }
  
  resolveAlert(alertId: string, resolvedBy?: string): boolean {
    const alert = this.activeAlerts.get(alertId)
    if (!alert || alert.resolved) return false
    
    alert.resolved = true
    alert.resolvedAt = Date.now()
    alert.resolvedBy = resolvedBy
    
    logger.info('Alert resolved', {
      category: 'monitoring_alert',
      component: 'realtime-monitor',
      metadata: {
        alertId,
        resolvedBy,
        duration: alert.resolvedAt - alert.timestamp
      }
    })
    
    return true
  }
  
  // Alert checking methods
  private checkAgentAlerts(status: AgentStatus): void {
    const now = Date.now()
    
    // Check idle time
    if (status.status === 'idle' && (now - status.lastHeartbeat) > this.config.thresholds.agent.maxIdleTime) {
      this.createAlert(
        'threshold',
        'warning',
        'Agent idle too long',
        `Agent ${status.agentId} has been idle for ${Math.round((now - status.lastHeartbeat) / 60000)} minutes`,
        'agent-monitor',
        {
          agentId: status.agentId,
          threshold: {
            metric: 'idle_time',
            value: now - status.lastHeartbeat,
            limit: this.config.thresholds.agent.maxIdleTime,
            operator: '>'
          }
        }
      )
    }
    
    // Check error rate
    if (status.performance.errorCount > 0 && 
        status.performance.successRate < (1 - this.config.thresholds.agent.maxErrorRate)) {
      this.createAlert(
        'threshold',
        'error',
        'Agent error rate high',
        `Agent ${status.agentId} has error rate of ${(1 - status.performance.successRate) * 100}%`,
        'agent-monitor',
        {
          agentId: status.agentId,
          threshold: {
            metric: 'error_rate',
            value: 1 - status.performance.successRate,
            limit: this.config.thresholds.agent.maxErrorRate,
            operator: '>'
          }
        }
      )
    }
    
    // Check memory usage
    if (status.resources.memoryUsage && status.resources.memoryUsage > this.config.thresholds.agent.maxMemoryUsage) {
      this.createAlert(
        'threshold',
        'warning',
        'Agent memory usage high',
        `Agent ${status.agentId} memory usage at ${Math.round(status.resources.memoryUsage * 100)}%`,
        'agent-monitor',
        {
          agentId: status.agentId,
          threshold: {
            metric: 'memory_usage',
            value: status.resources.memoryUsage,
            limit: this.config.thresholds.agent.maxMemoryUsage,
            operator: '>'
          }
        }
      )
    }
  }
  
  private checkExecutionAlerts(execution: ExecutionMonitoring): void {
    // Check execution timeout
    if (execution.status === 'running' && 
        execution.timing.startedAt && 
        execution.timing.estimatedDuration) {
      
      const elapsed = Date.now() - execution.timing.startedAt
      if (elapsed > execution.timing.estimatedDuration * 2) { // 200% of estimated time
        this.createAlert(
          'sla_violation',
          'warning',
          'Execution running long',
          `Execution ${execution.executionId} has exceeded estimated duration`,
          'execution-monitor',
          {
            agentId: execution.agentId,
            executionId: execution.executionId,
            projectId: execution.projectId,
            metadata: {
              elapsed,
              estimated: execution.timing.estimatedDuration
            }
          }
        )
      }
    }
    
    // Check critical errors
    const criticalErrors = execution.errors.filter(e => e.severity === 'critical')
    if (criticalErrors.length > 0) {
      this.createAlert(
        'system_error',
        'critical',
        'Execution critical error',
        `Execution ${execution.executionId} encountered critical errors`,
        'execution-monitor',
        {
          agentId: execution.agentId,
          executionId: execution.executionId,
          projectId: execution.projectId,
          metadata: {
            errorCount: criticalErrors.length,
            lastError: criticalErrors[criticalErrors.length - 1]
          }
        }
      )
    }
  }
  
  private checkSystemAlerts(health: SystemHealth): void {
    // Check CPU usage
    if (health.resources.cpuUsage.current > this.config.thresholds.system.maxCpuUsage) {
      this.createAlert(
        'threshold',
        'warning',
        'High CPU usage',
        `System CPU usage at ${Math.round(health.resources.cpuUsage.current * 100)}%`,
        'system-monitor',
        {
          threshold: {
            metric: 'cpu_usage',
            value: health.resources.cpuUsage.current,
            limit: this.config.thresholds.system.maxCpuUsage,
            operator: '>'
          }
        }
      )
    }
    
    // Check memory usage
    if (health.resources.memoryUsage.percentage > this.config.thresholds.system.maxMemoryUsage) {
      this.createAlert(
        'threshold',
        'warning',
        'High memory usage',
        `System memory usage at ${Math.round(health.resources.memoryUsage.percentage * 100)}%`,
        'system-monitor',
        {
          threshold: {
            metric: 'memory_usage',
            value: health.resources.memoryUsage.percentage,
            limit: this.config.thresholds.system.maxMemoryUsage,
            operator: '>'
          }
        }
      )
    }
  }
  
  // Event listener management
  addListener(listener: MonitoringEventListener): void {
    this.listeners.push(listener)
  }
  
  removeListener(listener: MonitoringEventListener): void {
    const index = this.listeners.indexOf(listener)
    if (index > -1) {
      this.listeners.splice(index, 1)
    }
  }
  
  private notifyListeners(callback: (listener: MonitoringEventListener) => void): void {
    this.listeners.forEach(listener => {
      try {
        callback(listener)
      } catch (error) {
        logger.error('Monitoring listener error', error as Error, {
          component: 'realtime-monitor'
        })
      }
    })
  }
  
  // Data access methods
  getAgentStatus(agentId: string): AgentStatus | undefined {
    return this.agentStatuses.get(agentId)
  }
  
  getAllAgentStatuses(): AgentStatus[] {
    return Array.from(this.agentStatuses.values())
  }
  
  getExecutionStatus(executionId: string): ExecutionMonitoring | undefined {
    return this.executions.get(executionId)
  }
  
  getAllExecutions(): ExecutionMonitoring[] {
    return Array.from(this.executions.values())
  }
  
  getSystemHealth(): SystemHealth | null {
    return this.systemHealth
  }
  
  getActiveAlerts(): MonitoringAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved)
  }
  
  getAllAlerts(): MonitoringAlert[] {
    return Array.from(this.activeAlerts.values())
  }
  
  // Private helper methods
  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.updateSystemHealth().catch(error => {
        logger.error('Health check failed', error as Error, {
          component: 'realtime-monitor'
        })
      })
    }, this.config.healthChecks.interval)
  }
  
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanup()
    }, 300000) // 5 minutes
  }
  
  private cleanup(): void {
    const now = Date.now()
    const realtimeThreshold = now - (this.config.retention.realtimeDataHours * 3600000)
    
    // Clean up old executions
    for (const [executionId, execution] of this.executions) {
      if (execution.timing.queuedAt < realtimeThreshold) {
        this.executions.delete(executionId)
      }
    }
    
    // Clean up old alerts
    const alertThreshold = now - (this.config.retention.alertHistoryDays * 24 * 3600000)
    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.timestamp < alertThreshold) {
        this.activeAlerts.delete(alertId)
      }
    }
  }
  
  private async checkDatabaseHealth(): Promise<SystemHealth['components'][string]> {
    try {
      // In a real implementation, this would ping the database
      return {
        status: 'healthy',
        lastCheck: Date.now(),
        responseTime: 50,
        details: 'Database connection healthy'
      }
    } catch (error) {
      return {
        status: 'critical',
        lastCheck: Date.now(),
        details: `Database connection failed: ${(error as Error).message}`
      }
    }
  }
  
  private calculateOverallHealth(componentStatuses: SystemHealth['components'][string]['status'][]): SystemHealth['overall'] {
    if (componentStatuses.includes('offline') || componentStatuses.includes('critical')) {
      return 'critical'
    }
    if (componentStatuses.includes('degraded')) {
      return 'degraded'
    }
    return 'healthy'
  }
  
  private getMemoryUsage(): SystemHealth['resources']['memoryUsage'] {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage()
      const total = usage.heapTotal + usage.external + usage.rss
      const used = usage.heapUsed
      
      return {
        used,
        total,
        percentage: total > 0 ? used / total : 0
      }
    }
    
    return { used: 0, total: 0, percentage: 0 }
  }
  
  private getCpuUsage(): number {
    // In a real implementation, this would measure actual CPU usage
    return Math.random() * 0.1 // Mock: 0-10% usage
  }
  
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }
  
  // Cleanup
  async close(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    
    logger.info('Real-time monitoring stopped', {
      category: 'system_shutdown',
      component: 'realtime-monitor'
    })
  }
}

// Global monitoring instance
export const realtimeMonitor = new RealtimeMonitor()

// Utility functions for common monitoring patterns
export const trackAgentStatus = (agentId: string, status: AgentStatus['status'], metadata?: Record<string, any>): void => {
  realtimeMonitor.updateAgentStatus(agentId, {
    status,
    metadata: metadata || {}
  })
}

export const startExecutionTracking = (
  executionId: string,
  agentId: string,
  projectId: string,
  estimatedDuration?: number
): void => {
  realtimeMonitor.startExecutionMonitoring(executionId, agentId, projectId, estimatedDuration)
}

export const updateExecutionStatus = (
  executionId: string,
  status: ExecutionMonitoring['status'],
  progress?: number,
  metadata?: Record<string, any>
): void => {
  const updates: Partial<Pick<ExecutionMonitoring, 'status' | 'progress'>> = {
    status,
    progress: progress !== undefined ? { percentage: progress, phases: [] } : undefined
  }
  
  realtimeMonitor.updateExecutionProgress(executionId, updates)
}

export const createMonitoringDashboard = (): {
  getAgentStatuses: () => AgentStatus[]
  getExecutions: () => ExecutionMonitoring[]
  getSystemHealth: () => SystemHealth | null
  getAlerts: () => MonitoringAlert[]
  subscribeToUpdates: (listener: MonitoringEventListener) => void
} => {
  return {
    getAgentStatuses: () => realtimeMonitor.getAllAgentStatuses(),
    getExecutions: () => realtimeMonitor.getAllExecutions(),
    getSystemHealth: () => realtimeMonitor.getSystemHealth(),
    getAlerts: () => realtimeMonitor.getActiveAlerts(),
    subscribeToUpdates: (listener: MonitoringEventListener) => realtimeMonitor.addListener(listener)
  }
}