// src/lib/realtime-subscriptions.ts - Real-time Updates using Convex Subscriptions

import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Id } from '../../convex/_generated/dataModel'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { Project, Agent, Execution, SystemHealth } from '~/types/exports'

// Mock data for development
const mockProject: Project = {
  _id: 'mock-project',
  _creationTime: Date.now() - 86400000,
  name: 'Mock Project',
  description: 'A sample project for development',
  status: 'active',
  createdAt: Date.now() - 86400000, // 1 day ago
  updatedAt: Date.now() - 3600000,  // 1 hour ago
  statistics: { totalExecutions: 5, successfulExecutions: 4, failedExecutions: 1, totalTokensUsed: 1250, totalCostIncurred: 0.23 },
  configuration: {
    defaultTimeout: 1800000,
    maxConcurrentExecutions: 5,
    errorHandling: 'fail-fast'
  },
  resourceLimits: {
    maxTokensPerExecution: 10000,
    maxCostPerExecution: 1.0,
    maxExecutionTime: 1800000
  },
  metadata: {}
}

const mockAgent: Agent = {
  _id: 'mock-agent',
  _creationTime: Date.now() - 86400000,
  name: 'Mock Agent',
  projectId: 'mock-project',
  role: 'expert',
  status: 'ready',
  lastActiveAt: Date.now(),
  performance: { totalExecutions: 0, successfulExecutions: 0, failedExecutions: 0, avgExecutionTime: 0 },
  configuration: {
    modelConfig: { modelType: 'gpt-4', tokenLimit: 4000 },
    parameters: {}
  },
  capabilities: ['text-generation', 'analysis']
}

const mockExecution: Execution = {
  _id: 'mock-execution',
  _creationTime: Date.now() - 5000,
  projectId: 'mock-project',
  status: 'completed',
  priority: 'normal',
  startedAt: Date.now() - 5000,
  completedAt: Date.now(),
  configuration: { timeout: 1800000 },
  progress: { completedSteps: ['step1'], failedSteps: [], activeSteps: [], totalSteps: 1, percentage: 1 },
  workflowDefinition: { 
    name: 'Mock Workflow', 
    pattern: 'sequential',
    steps: [{ id: 'step1', name: 'Mock Step', agentId: 'mock-agent' }] 
  },
  performance: { totalTokensUsed: 100, totalCostIncurred: 0.01, executionTime: 5000 }
}

// Types for real-time data
export interface RealtimeExecutionUpdate {
  executionId: Id<'executions'>
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  progress: {
    percentage: number
    currentStep: number
    totalSteps: number
    completedSteps: string[]
    failedSteps: string[]
    activeSteps: string[]
  }
  performance?: {
    totalTokensUsed: number
    totalCostIncurred: number
    executionTime: number
    memoryPeak: number
  }
  timestamp: number
}

export interface RealtimeAgentUpdate {
  agentId: Id<'agents'>
  status: 'created' | 'configuring' | 'ready' | 'active' | 'paused' | 'error' | 'archived'
  performance: {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    avgExecutionTime: number
    totalTokensUsed: number
    totalCostIncurred: number
  }
  lastActiveAt: number
  currentExecution?: Id<'executions'>
}

export interface RealtimeProjectUpdate {
  projectId: Id<'projects'>
  statistics: {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    totalTokensUsed: number
    totalCostIncurred: number
  }
  activeExecutions: number
  timestamp: number
}

export interface RealtimeSystemHealth {
  overall: 'healthy' | 'degraded' | 'critical' | 'offline'
  activeAgents: number
  runningExecutions: number
  queuedExecutions: number
  avgResponseTime: number
  errorRate: number
  timestamp: number
}

// Subscription hooks for real-time data

// Project subscriptions
export const useRealtimeProject = (projectId?: Id<'projects'>) => {
  // Using mock data until API is available
  const project = mockProject // useQuery(api.projects.getById, projectId ? { id: projectId } : 'skip')
  const projectStatistics = mockProject.statistics // useQuery(api.projects.getStatistics, projectId ? { id: projectId, timeRange: 3600000 } : 'skip')
  const projectExecutions = [mockExecution] // useQuery(api.projects.getExecutions, projectId ? { id: projectId, status: 'running', limit: 10 } : 'skip')

  return {
    project,
    statistics: projectStatistics,
    activeExecutions: projectExecutions,
    isLoading: false, // project === undefined || projectStatistics === undefined,
    error: null // Convex handles errors automatically
  }
}

export const useRealtimeProjectList = (filters?: {
  status?: 'active' | 'paused' | 'completed' | 'archived'
  limit?: number
}) => {
  const projects = [mockProject] // useQuery(api.projects.list, filters || {})
  
  return {
    projects: projects || [],
    isLoading: false
  }
}

// Agent subscriptions
export const useRealtimeAgent = (agentId?: Id<'agents'>) => {
  const agent = mockAgent // useQuery(api.agents.getById, agentId ? { id: agentId } : 'skip')
  const performance = mockAgent.performance // useQuery(api.agents.getPerformanceMetrics, agentId ? { id: agentId, timeRange: 3600000 } : 'skip')

  return {
    agent,
    performance,
    isLoading: false
  }
}

export const useRealtimeAgentList = (filters?: {
  projectId?: Id<'projects'>
  status?: 'created' | 'configuring' | 'ready' | 'active' | 'paused' | 'error' | 'archived'
  role?: 'planner' | 'director' | 'coordinator' | 'expert' | 'builder'
  limit?: number
}) => {
  const agents = [mockAgent] // useQuery(api.agents.list, filters || {})
  
  // Transform agents data to include real-time status
  const realtimeAgents = useMemo(() => {
    if (!agents || !Array.isArray(agents)) return []
    
    return agents.map((agent: any) => ({
      ...agent,
      isActive: agent.status === 'active',
      hasCurrentExecution: agent.lastActiveAt > Date.now() - 300000, // 5 minutes
      performanceScore: calculateAgentPerformanceScore(agent.performance)
    }))
  }, [agents])

  return {
    agents: realtimeAgents,
    activeCount: realtimeAgents.filter(a => a.status === 'active').length,
    totalCount: realtimeAgents.length,
    isLoading: agents === undefined
  }
}

// Execution subscriptions
export const useRealtimeExecution = (executionId?: Id<'executions'>) => {
  const execution = mockExecution // useQuery(api.executions.getById, executionId ? { id: executionId } : 'skip')
  const metrics = mockExecution.performance // useQuery(api.executions.getMetrics, executionId ? { id: executionId } : 'skip')
  const logs: any[] = [] // useQuery(api.executions.getLogs, executionId ? { id: executionId, limit: 50 } : 'skip')

  // Calculate real-time progress
  const realtimeProgress = useMemo(() => {
    if (!execution || typeof execution !== 'object') return null
    
    const progress = execution.progress || { completedSteps: [], failedSteps: [], activeSteps: [], totalSteps: 1, percentage: 1 }
    const isRunning = (execution.status as string) === 'running' || (execution.status as string) === 'pending'
    const estimatedCompletion = isRunning && execution.startedAt 
      ? execution.startedAt + (execution.configuration?.timeout || 1800000)
      : null

    return {
      ...progress,
      currentStep: progress.completedSteps?.length || 0,
      isRunning,
      estimatedCompletion,
      stepStatus: (execution.workflowDefinition?.steps || []).map((step: any) => ({
        id: step.id,
        name: step.name,
        status: (progress.completedSteps as string[] || []).includes(step.id) ? 'completed' :
                (progress.failedSteps as string[] || []).includes(step.id) ? 'failed' :
                (progress.activeSteps as string[] || []).includes(step.id) ? 'running' : 'pending'
      }))
    }
  }, [execution])

  return {
    execution,
    progress: realtimeProgress,
    metrics,
    logs: logs || [],
    isLoading: execution === undefined,
    isRunning: execution && typeof execution === 'object' ? (execution.status as string) === 'running' : false,
    isCompleted: execution && typeof execution === 'object' ? (execution.status as string) === 'completed' : false,
    hasFailed: execution && typeof execution === 'object' ? (execution.status as string) === 'failed' : false
  }
}

export const useRealtimeExecutionList = (filters?: {
  projectId?: Id<'projects'>
  agentId?: Id<'agents'>
  status?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  priority?: 'low' | 'normal' | 'high' | 'urgent'
  limit?: number
}) => {
  const executions = [mockExecution] // useQuery(api.executions.list, filters || { limit: 20 })
  const queueStatus = { 
    queue: { running: 0, pending: 1, failed: 0, total: 1 }, 
    performance: { avgExecutionTime: 5000 } 
  } // useQuery(api.executions.getQueueStatus, filters?.projectId ? { projectId: filters.projectId } : {})

  // Transform executions with real-time status
  const realtimeExecutions = useMemo(() => {
    if (!executions || !Array.isArray(executions)) return []
    
    return executions.map((execution: any) => ({
      ...execution,
      isActive: ['pending', 'running'].includes(execution.status),
      duration: execution.completedAt && execution.startedAt 
        ? execution.completedAt - execution.startedAt
        : execution.startedAt 
          ? Date.now() - execution.startedAt 
          : null,
      waitTime: execution.startedAt 
        ? execution.startedAt - execution.createdAt 
        : Date.now() - execution.createdAt,
      progressText: `${execution.progress.completedSteps.length}/${execution.progress.totalSteps} steps`
    }))
  }, [executions])

  return {
    executions: realtimeExecutions,
    queueStatus,
    runningCount: realtimeExecutions.filter((e: any) => e.status === 'running').length,
    pendingCount: realtimeExecutions.filter((e: any) => e.status === 'pending').length,
    isLoading: executions === undefined
  }
}

// System-wide monitoring subscriptions
export const useRealtimeSystemHealth = () => {
  const [systemHealth, setSystemHealth] = useState<RealtimeSystemHealth>({
    overall: 'healthy',
    activeAgents: 0,
    runningExecutions: 0,
    queuedExecutions: 0,
    avgResponseTime: 0,
    errorRate: 0,
    timestamp: Date.now()
  })

  // Get system-wide data
  const allAgents = [mockAgent] // useQuery(api.agents.list, { status: 'active' })
  const allExecutions = [mockExecution] // useQuery(api.executions.list, { limit: 100 })
  const queueStatus = { 
    queue: { running: 0, pending: 1, failed: 0, total: 1 }, 
    performance: { avgExecutionTime: 5000 } 
  } // useQuery(api.executions.getQueueStatus, {})

  // Update system health when data changes
  useEffect(() => {
    if (allAgents && allExecutions && queueStatus && 
        typeof queueStatus === 'object' && queueStatus.queue) {
      const runningExecutions = queueStatus.queue.running || 0
      const queuedExecutions = queueStatus.queue.pending || 0
      const failedExecutions = queueStatus.queue.failed || 0
      const totalExecutions = queueStatus.queue.total || 0

      const errorRate = totalExecutions > 0 ? failedExecutions / totalExecutions : 0
      const avgResponseTime = queueStatus.performance?.avgExecutionTime || 0

      // Determine overall health
      let overall: RealtimeSystemHealth['overall'] = 'healthy'
      if (errorRate > 0.2 || avgResponseTime > 300000) { // 20% error rate or 5min avg time
        overall = 'critical'
      } else if (errorRate > 0.1 || avgResponseTime > 120000) { // 10% error rate or 2min avg time
        overall = 'degraded'
      }

      setSystemHealth({
        overall,
        activeAgents: Array.isArray(allAgents) ? allAgents.length : 0,
        runningExecutions,
        queuedExecutions,
        avgResponseTime,
        errorRate,
        timestamp: Date.now()
      })
    }
  }, [allAgents, allExecutions, queueStatus])

  return {
    health: systemHealth,
    isLoading: !allAgents || !allExecutions || !queueStatus
  }
}

// Custom hooks for specific real-time features

// Live execution tracking with automatic updates
export const useLiveExecutionTracking = (executionId?: Id<'executions'>) => {
  const { execution, progress, metrics, isRunning } = useRealtimeExecution(executionId)
  const [updateHistory, setUpdateHistory] = useState<RealtimeExecutionUpdate[]>([])

  // Track execution updates
  useEffect(() => {
    if (execution && progress && typeof execution === 'object' && '_id' in execution) {
      const update: RealtimeExecutionUpdate = {
        executionId: execution._id as Id<'executions'>,
        status: execution.status,
        progress: progress,
        performance: {
          ...execution.performance,
          memoryPeak: (execution.performance as any)?.memoryPeak || 0
        },
        timestamp: Date.now()
      }

      setUpdateHistory(prev => [...prev.slice(-9), update]) // Keep last 10 updates
    }
  }, [execution, progress])

  // Calculate execution velocity (steps per minute)
  const velocity = useMemo(() => {
    if (!execution || typeof execution !== 'object' || !execution.startedAt || !progress) return 0
    const elapsedMinutes = (Date.now() - execution.startedAt) / 60000
    return elapsedMinutes > 0 ? (progress.completedSteps?.length || 0) / elapsedMinutes : 0
  }, [execution, progress])

  // Estimate completion time
  const estimatedCompletion = useMemo(() => {
    if (!isRunning || !progress || !velocity || velocity === 0) return null
    const remainingSteps = (progress.totalSteps || 0) - (progress.completedSteps?.length || 0)
    const estimatedMinutes = remainingSteps / velocity
    return Date.now() + (estimatedMinutes * 60000)
  }, [isRunning, progress, velocity])

  return {
    execution,
    progress,
    metrics,
    updateHistory,
    velocity,
    estimatedCompletion,
    isRunning
  }
}

// Real-time cost tracking across projects
export const useRealtimeCostTracking = (projectId?: Id<'projects'>) => {
  const projectStats = mockProject.statistics // useQuery(api.projects.getStatistics, projectId ? { id: projectId, timeRange: 86400000 } : 'skip')

  const [costTrends, setCostTrends] = useState<Array<{
    timestamp: number
    totalCost: number
    hourlyRate: number
  }>>([])

  // Update cost trends
  useEffect(() => {
    if (projectStats && typeof projectStats === 'object' && 'totalCostIncurred' in projectStats) {
      const now = Date.now()
      const hourlyRate = projectStats.totalCostIncurred // Simplified - would calculate actual hourly rate
      
      setCostTrends(prev => [
        ...prev.filter(trend => now - trend.timestamp < 86400000).slice(-23), // Keep 24 hours of data
        {
          timestamp: now,
          totalCost: projectStats.totalCostIncurred,
          hourlyRate
        }
      ])
    }
  }, [projectStats])

  return {
    currentCost: (projectStats && typeof projectStats === 'object' && 'totalCostIncurred' in projectStats) 
      ? projectStats.totalCostIncurred : 0,
    totalTokens: (projectStats && typeof projectStats === 'object' && 'totalTokensUsed' in projectStats) 
      ? projectStats.totalTokensUsed : 0,
    costPerToken: (projectStats && typeof projectStats === 'object' && 
                  'totalTokensUsed' in projectStats && 'totalCostIncurred' in projectStats &&
                  projectStats.totalTokensUsed > 0) 
      ? projectStats.totalCostIncurred / projectStats.totalTokensUsed 
      : 0,
    costTrends,
    isLoading: projectStats === undefined
  }
}

// Real-time alerts and notifications
export const useRealtimeAlerts = (projectId?: Id<'projects'>) => {
  const [alerts, setAlerts] = useState<Array<{
    id: string
    type: 'execution_failed' | 'cost_threshold' | 'performance_degradation' | 'agent_error'
    message: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    timestamp: number
    projectId?: Id<'projects'>
    executionId?: Id<'executions'>
    agentId?: Id<'agents'>
  }>>([])

  const executions: any[] = [] // useQuery(api.executions.list, projectId ? { projectId, status: 'failed', limit: 10 } : { status: 'failed', limit: 10 })

  const agents: any[] = [] // useQuery(api.agents.list, projectId ? { projectId, status: 'error', limit: 10 } : { status: 'error', limit: 10 })

  // Monitor for failed executions
  useEffect(() => {
    if (executions && Array.isArray(executions)) {
      const newFailures = executions.filter((e: any) => 
        !alerts.some(alert => alert.executionId === e._id)
      )

      newFailures.forEach((execution: any) => {
        setAlerts(prev => [...prev, {
          id: `execution_failed_${execution._id}`,
          type: 'execution_failed',
          message: `Execution "${execution.workflowDefinition.name}" failed`,
          severity: 'high',
          timestamp: Date.now(),
          projectId: execution.projectId,
          executionId: execution._id
        }])
      })
    }
  }, [executions, alerts])

  // Monitor for agent errors
  useEffect(() => {
    if (agents && Array.isArray(agents)) {
      const newErrors = agents.filter((a: any) => 
        !alerts.some(alert => alert.agentId === a._id)
      )

      newErrors.forEach((agent: any) => {
        setAlerts(prev => [...prev, {
          id: `agent_error_${agent._id}`,
          type: 'agent_error',
          message: `Agent "${agent.name}" is in error state`,
          severity: 'medium',
          timestamp: Date.now(),
          projectId: agent.projectId,
          agentId: agent._id
        }])
      })
    }
  }, [agents, alerts])

  // Auto-clear old alerts
  useEffect(() => {
    const cleanup = setInterval(() => {
      setAlerts(prev => prev.filter(alert => 
        Date.now() - alert.timestamp < 3600000 // Keep for 1 hour
      ))
    }, 300000) // Clean up every 5 minutes

    return () => clearInterval(cleanup)
  }, [])

  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }, [])

  return {
    alerts: alerts.sort((a, b) => b.timestamp - a.timestamp),
    unreadCount: alerts.length,
    dismissAlert,
    criticalAlerts: alerts.filter(a => a.severity === 'critical'),
    highAlerts: alerts.filter(a => a.severity === 'high')
  }
}

// Utility functions
const calculateAgentPerformanceScore = (performance: any): number => {
  if (!performance || performance.totalExecutions === 0) return 100
  
  const successRate = performance.successfulExecutions / performance.totalExecutions
  const avgTime = performance.avgExecutionTime || 60000 // Default 1 minute
  const timeScore = Math.max(0, 100 - (avgTime / 1000 - 30)) // Penalize executions longer than 30s
  
  return Math.round((successRate * 70) + (timeScore * 30)) // 70% success rate, 30% speed
}

// WebSocket-like event emitter for additional real-time features
class RealtimeEventEmitter {
  private listeners: Map<string, Set<Function>> = new Map()

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  off(event: string, callback: Function) {
    this.listeners.get(event)?.delete(callback)
  }

  emit(event: string, data: any) {
    this.listeners.get(event)?.forEach(callback => callback(data))
  }
}

export const realtimeEvents = new RealtimeEventEmitter()

// Hook to emit execution events
export const useExecutionEvents = (executionId?: Id<'executions'>) => {
  const { execution } = useRealtimeExecution(executionId)
  const [prevStatus, setPrevStatus] = useState<string | null>(null)

  useEffect(() => {
    if (execution && typeof execution === 'object' && 'status' in execution && 
        prevStatus !== execution.status) {
      if (prevStatus !== null) { // Not the first load
        realtimeEvents.emit('execution_status_change', {
          executionId: '_id' in execution ? execution._id : executionId,
          oldStatus: prevStatus,
          newStatus: execution.status,
          timestamp: Date.now()
        })
      }
      setPrevStatus(execution.status)
    }
  }, [execution, prevStatus, executionId])
}

export default {
  useRealtimeProject,
  useRealtimeProjectList,
  useRealtimeAgent,
  useRealtimeAgentList,
  useRealtimeExecution,
  useRealtimeExecutionList,
  useRealtimeSystemHealth,
  useLiveExecutionTracking,
  useRealtimeCostTracking,
  useRealtimeAlerts,
  realtimeEvents
}