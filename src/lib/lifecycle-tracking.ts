// src/lib/lifecycle-tracking.ts

import { z } from 'zod'

// Agent lifecycle states
export const AGENT_LIFECYCLE_STATES = {
  created: {
    name: 'Created',
    description: 'Agent has been defined but not yet configured',
    canTransitionTo: ['configuring', 'draft']
  },
  draft: {
    name: 'Draft',
    description: 'Agent is being configured and is not ready for use',
    canTransitionTo: ['configuring', 'validating', 'archived']
  },
  configuring: {
    name: 'Configuring',
    description: 'Agent configuration is being set up or modified',
    canTransitionTo: ['validating', 'draft', 'error']
  },
  validating: {
    name: 'Validating',
    description: 'Agent configuration is being validated',
    canTransitionTo: ['ready', 'draft', 'error']
  },
  ready: {
    name: 'Ready',
    description: 'Agent is configured and ready for assignment',
    canTransitionTo: ['assigned', 'configuring', 'archived', 'deprecated']
  },
  assigned: {
    name: 'Assigned',
    description: 'Agent has been assigned to a project/workflow',
    canTransitionTo: ['active', 'ready', 'suspended']
  },
  active: {
    name: 'Active',
    description: 'Agent is actively executing tasks',
    canTransitionTo: ['idle', 'busy', 'paused', 'error', 'completed']
  },
  idle: {
    name: 'Idle',
    description: 'Agent is available but not currently executing',
    canTransitionTo: ['active', 'busy', 'paused', 'completed']
  },
  busy: {
    name: 'Busy',
    description: 'Agent is actively processing tasks',
    canTransitionTo: ['idle', 'active', 'paused', 'error', 'completed']
  },
  paused: {
    name: 'Paused',
    description: 'Agent execution has been paused',
    canTransitionTo: ['active', 'idle', 'completed', 'error']
  },
  error: {
    name: 'Error',
    description: 'Agent has encountered an error',
    canTransitionTo: ['configuring', 'paused', 'terminated']
  },
  completed: {
    name: 'Completed',
    description: 'Agent has completed its assigned tasks',
    canTransitionTo: ['ready', 'archived']
  },
  suspended: {
    name: 'Suspended',
    description: 'Agent has been temporarily suspended',
    canTransitionTo: ['assigned', 'ready', 'terminated']
  },
  terminated: {
    name: 'Terminated',
    description: 'Agent execution has been terminated',
    canTransitionTo: ['archived']
  },
  archived: {
    name: 'Archived',
    description: 'Agent has been archived and is no longer active',
    canTransitionTo: []
  },
  deprecated: {
    name: 'Deprecated',
    description: 'Agent is deprecated but may still be referenced',
    canTransitionTo: ['archived']
  }
} as const

// Execution states for tasks/workflows
export const EXECUTION_STATES = {
  pending: {
    name: 'Pending',
    description: 'Execution is queued and waiting to start',
    canTransitionTo: ['running', 'cancelled']
  },
  running: {
    name: 'Running',
    description: 'Execution is actively running',
    canTransitionTo: ['paused', 'completed', 'failed', 'cancelled']
  },
  paused: {
    name: 'Paused',
    description: 'Execution has been paused',
    canTransitionTo: ['running', 'cancelled', 'completed']
  },
  completed: {
    name: 'Completed',
    description: 'Execution has completed successfully',
    canTransitionTo: []
  },
  failed: {
    name: 'Failed',
    description: 'Execution has failed with errors',
    canTransitionTo: ['pending', 'cancelled'] // Can retry
  },
  cancelled: {
    name: 'Cancelled',
    description: 'Execution was cancelled by user or system',
    canTransitionTo: []
  }
} as const

// Lifecycle event schema
export const lifecycleEventSchema = z.object({
  id: z.string(),
  entityType: z.enum(['agent', 'execution', 'task']),
  entityId: z.string(),
  fromState: z.string().optional(),
  toState: z.string(),
  event: z.string(),
  triggeredBy: z.enum(['user', 'system', 'agent', 'scheduler']),
  userId: z.string().optional(),
  reason: z.string().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
  timestamp: z.number(),
  duration: z.number().optional(), // Time in state (milliseconds)
})

export type LifecycleEvent = z.infer<typeof lifecycleEventSchema>

// Lifecycle metrics schema
export const lifecycleMetricsSchema = z.object({
  entityType: z.enum(['agent', 'execution', 'task']),
  entityId: z.string(),
  totalLifetime: z.number(), // Total time from creation to completion
  stateDistribution: z.record(z.string(), z.number()), // Time spent in each state
  transitionCount: z.number(),
  errorCount: z.number(),
  successRate: z.number().min(0).max(1),
  avgExecutionTime: z.number().optional(),
  lastActivity: z.number(),
  performanceScore: z.number().min(0).max(100).optional()
})

export type LifecycleMetrics = z.infer<typeof lifecycleMetricsSchema>

// Lifecycle tracker class
export class LifecycleTracker {
  private events: Map<string, LifecycleEvent[]> = new Map()
  private currentStates: Map<string, string> = new Map()
  
  // Track a lifecycle event
  trackEvent(
    entityType: LifecycleEvent['entityType'],
    entityId: string,
    toState: string,
    event: string,
    triggeredBy: LifecycleEvent['triggeredBy'],
    options: {
      userId?: string
      reason?: string
      metadata?: Record<string, any>
    } = {}
  ): LifecycleEvent {
    const entityKey = `${entityType}:${entityId}`
    const currentState = this.currentStates.get(entityKey)
    
    // Validate state transition
    if (currentState && !this.isValidTransition(entityType, currentState, toState)) {
      throw new Error(`Invalid state transition: ${currentState} -> ${toState} for ${entityType}`)
    }
    
    const lifecycleEvent: LifecycleEvent = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      entityType,
      entityId,
      fromState: currentState,
      toState,
      event,
      triggeredBy,
      userId: options.userId,
      reason: options.reason,
      metadata: options.metadata || {},
      timestamp: Date.now()
    }
    
    // Calculate duration in previous state
    if (currentState) {
      const previousEvents = this.events.get(entityKey) || []
      const lastEvent = previousEvents[previousEvents.length - 1]
      if (lastEvent) {
        lifecycleEvent.duration = lifecycleEvent.timestamp - lastEvent.timestamp
      }
    }
    
    // Store event
    const entityEvents = this.events.get(entityKey) || []
    entityEvents.push(lifecycleEvent)
    this.events.set(entityKey, entityEvents)
    
    // Update current state
    this.currentStates.set(entityKey, toState)
    
    return lifecycleEvent
  }
  
  // Get current state of an entity
  getCurrentState(entityType: LifecycleEvent['entityType'], entityId: string): string | undefined {
    return this.currentStates.get(`${entityType}:${entityId}`)
  }
  
  // Get all events for an entity
  getEntityEvents(entityType: LifecycleEvent['entityType'], entityId: string): LifecycleEvent[] {
    return this.events.get(`${entityType}:${entityId}`) || []
  }
  
  // Get events within time range
  getEventsInTimeRange(
    entityType: LifecycleEvent['entityType'],
    entityId: string,
    startTime: number,
    endTime: number
  ): LifecycleEvent[] {
    const events = this.getEntityEvents(entityType, entityId)
    return events.filter(event => 
      event.timestamp >= startTime && event.timestamp <= endTime
    )
  }
  
  // Calculate lifecycle metrics
  calculateMetrics(entityType: LifecycleEvent['entityType'], entityId: string): LifecycleMetrics {
    const events = this.getEntityEvents(entityType, entityId)
    if (events.length === 0) {
      throw new Error(`No events found for ${entityType}:${entityId}`)
    }
    
    const firstEvent = events[0]
    const lastEvent = events[events.length - 1]
    const totalLifetime = lastEvent.timestamp - firstEvent.timestamp
    
    // Calculate state distribution
    const stateDistribution: Record<string, number> = {}
    events.forEach(event => {
      if (event.duration) {
        stateDistribution[event.fromState!] = (stateDistribution[event.fromState!] || 0) + event.duration
      }
    })
    
    // Count errors
    const errorCount = events.filter(event => 
      event.toState === 'error' || event.toState === 'failed'
    ).length
    
    // Calculate success rate
    const completionEvents = events.filter(event => 
      event.toState === 'completed' || event.toState === 'success'
    ).length
    const totalExecutions = events.filter(event => 
      event.toState === 'completed' || event.toState === 'failed' || event.toState === 'error'
    ).length
    const successRate = totalExecutions > 0 ? completionEvents / totalExecutions : 0
    
    // Calculate average execution time (for executions)
    let avgExecutionTime: number | undefined
    if (entityType === 'execution') {
      const executionTimes = events.filter(event => 
        event.fromState === 'running' && (event.toState === 'completed' || event.toState === 'failed')
      ).map(event => event.duration || 0)
      
      if (executionTimes.length > 0) {
        avgExecutionTime = executionTimes.reduce((sum, time) => sum + time, 0) / executionTimes.length
      }
    }
    
    // Calculate performance score
    const performanceScore = this.calculatePerformanceScore(events, successRate, errorCount)
    
    return {
      entityType,
      entityId,
      totalLifetime,
      stateDistribution,
      transitionCount: events.length,
      errorCount,
      successRate,
      avgExecutionTime,
      lastActivity: lastEvent.timestamp,
      performanceScore
    }
  }
  
  // Get metrics for multiple entities
  getBatchMetrics(entities: Array<{ type: LifecycleEvent['entityType'], id: string }>): LifecycleMetrics[] {
    return entities.map(entity => this.calculateMetrics(entity.type, entity.id))
  }
  
  // Get system-wide statistics
  getSystemStats(): {
    totalEntities: number
    activeEntities: number
    completedEntities: number
    errorEntities: number
    avgSuccessRate: number
  } {
    const allStates = Array.from(this.currentStates.values())
    const totalEntities = allStates.length
    const activeEntities = allStates.filter(state => 
      ['active', 'busy', 'running', 'assigned'].includes(state)
    ).length
    const completedEntities = allStates.filter(state => 
      ['completed', 'archived'].includes(state)
    ).length
    const errorEntities = allStates.filter(state => 
      ['error', 'failed', 'terminated'].includes(state)
    ).length
    
    // Calculate average success rate across all entities
    const allMetrics = Array.from(this.events.keys()).map(key => {
      const [entityType, entityId] = key.split(':')
      try {
        return this.calculateMetrics(entityType as LifecycleEvent['entityType'], entityId)
      } catch {
        return null
      }
    }).filter(m => m !== null) as LifecycleMetrics[]
    
    const avgSuccessRate = allMetrics.length > 0 
      ? allMetrics.reduce((sum, m) => sum + m.successRate, 0) / allMetrics.length 
      : 0
    
    return {
      totalEntities,
      activeEntities,
      completedEntities,
      errorEntities,
      avgSuccessRate
    }
  }
  
  private isValidTransition(
    entityType: LifecycleEvent['entityType'],
    fromState: string,
    toState: string
  ): boolean {
    switch (entityType) {
      case 'agent': {
        const state = AGENT_LIFECYCLE_STATES[fromState as keyof typeof AGENT_LIFECYCLE_STATES]
        return state ? (state.canTransitionTo as readonly string[]).includes(toState) : true
      }
      case 'execution':
      case 'task': {
        const state = EXECUTION_STATES[fromState as keyof typeof EXECUTION_STATES]
        return state ? (state.canTransitionTo as readonly string[]).includes(toState) : true
      }
      default:
        return true // Allow any transition for unknown types
    }
  }
  
  private calculatePerformanceScore(
    events: LifecycleEvent[],
    successRate: number,
    errorCount: number
  ): number {
    let score = 100
    
    // Deduct for errors
    score -= Math.min(errorCount * 5, 40) // Max 40 points deduction for errors
    
    // Factor in success rate
    score *= successRate
    
    // Bonus for consistent performance (few state changes)
    const avgTransitionsPerDay = events.length / Math.max(1, this.getDaysSpan(events))
    if (avgTransitionsPerDay < 10) {
      score += 5 // Bonus for stability
    }
    
    // Deduct for rapid state changes (thrashing)
    const rapidTransitions = events.filter((event, index) => {
      if (index === 0) return false
      const prevEvent = events[index - 1]
      return (event.timestamp - prevEvent.timestamp) < 60000 // Less than 1 minute
    }).length
    
    score -= rapidTransitions * 2
    
    return Math.max(0, Math.min(100, score))
  }
  
  private getDaysSpan(events: LifecycleEvent[]): number {
    if (events.length < 2) return 1
    const firstEvent = events[0]
    const lastEvent = events[events.length - 1]
    return Math.max(1, (lastEvent.timestamp - firstEvent.timestamp) / (1000 * 60 * 60 * 24))
  }
}

// Utility functions
export const createLifecycleTracker = (): LifecycleTracker => {
  return new LifecycleTracker()
}

export const getValidTransitions = (
  entityType: LifecycleEvent['entityType'],
  currentState: string
): string[] => {
  switch (entityType) {
    case 'agent': {
      const state = AGENT_LIFECYCLE_STATES[currentState as keyof typeof AGENT_LIFECYCLE_STATES]
      return state ? [...state.canTransitionTo] : []
    }
    case 'execution':
    case 'task': {
      const state = EXECUTION_STATES[currentState as keyof typeof EXECUTION_STATES]
      return state ? [...state.canTransitionTo] : []
    }
    default:
      return []
  }
}

export const formatLifecycleEvent = (event: LifecycleEvent): string => {
  const transition = event.fromState 
    ? `${event.fromState} → ${event.toState}`
    : `Started as ${event.toState}`
  
  return `${event.entityType}:${event.entityId} ${transition} (${event.event}) by ${event.triggeredBy}`
}

export const getStateDescription = (
  entityType: LifecycleEvent['entityType'],
  state: string
): string => {
  switch (entityType) {
    case 'agent': {
      const stateInfo = AGENT_LIFECYCLE_STATES[state as keyof typeof AGENT_LIFECYCLE_STATES]
      return stateInfo ? stateInfo.description : 'Unknown state'
    }
    case 'execution':
    case 'task': {
      const stateInfo = EXECUTION_STATES[state as keyof typeof EXECUTION_STATES]
      return stateInfo ? stateInfo.description : 'Unknown state'
    }
    default:
      return 'Unknown state'
  }
}