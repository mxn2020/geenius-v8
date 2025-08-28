// src/queries.ts - Updated for clean backend with proper types

import { useMutation } from '@tanstack/react-query'
import { convexQuery, useConvexMutation, useConvex } from '@convex-dev/react-query'
import { api } from '../convex/_generated/api'
import { 
  type Id, 
  type ProjectStatus,
  type AgentStatus,
  type AgentRole,
  type WorkflowPattern,
  type ExecutionStatus,
  type PriorityLevel,
  type ProjectFilters,
  type AgentFilters,
  type ExecutionFilters
} from './types'

// ============================================================================
// PROJECT QUERIES & MUTATIONS
// ============================================================================

export const projectQueries = {
  // List all projects with optional filters
  list: (filters?: {
    status?: ProjectStatus
    createdBy?: string
    dateRange?: {
      start: number
      end: number
    }
    limit?: number
    offset?: number
  }) => convexQuery(api.projects.list, { filters }),
  
  // Get user's projects
  userProjects: (authUserId: string, limit?: number, offset?: number) =>
    convexQuery(api.projects.getUserProjects, { authUserId, limit, offset }),
  
  // Get project details
  detail: (id: Id<'projects'>, authUserId?: string) =>
    convexQuery(api.projects.getById, { id, authUserId }),
  
  // Get project statistics
  statistics: (id: Id<'projects'>, authUserId?: string, timeRange?: number) =>
    convexQuery(api.projects.getStatistics, { id, authUserId, timeRange }),
  
  // Get project agents
  agents: (id: Id<'projects'>, authUserId?: string, limit?: number, offset?: number) =>
    convexQuery(api.projects.getAgents, { id, authUserId, limit, offset }),
  
  // Get project executions
  executions: (id: Id<'projects'>, authUserId?: string, status?: ExecutionStatus, limit?: number, offset?: number) =>
    convexQuery(api.projects.getExecutions, { id, authUserId, status, limit, offset }),
}

// Create project mutation
export function useCreateProjectMutation() {
  const mutationFn = useConvexMutation(api.projects.create)
    .withOptimisticUpdate((localStore, args) => {
      const existingProjects = localStore.getQuery(api.projects.list, { filters: undefined })
      if (!existingProjects?.data) return

      const optimisticProject = {
        _id: `temp_${Date.now()}` as Id<'projects'>,
        _creationTime: Date.now(),
        name: args.name,
        description: args.description,
        status: 'active' as const,
        configuration: {
          defaultTimeout: 1800000,
          maxConcurrentExecutions: 5,
          errorHandling: 'fail-fast' as const
        },
        resourceLimits: {
          maxTokensPerExecution: 100000,
          maxCostPerExecution: 1.0,
          maxExecutionTime: 3600000
        },
        statistics: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalTokensUsed: 0,
          totalCostIncurred: 0,
        },
        createdBy: args.createdBy,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: args.metadata || {},
      }

      localStore.setQuery(
        api.projects.list, 
        { filters: undefined }, 
        {
          ...existingProjects,
          data: [optimisticProject, ...existingProjects.data]
        }
      )
    })

  return useMutation({ mutationFn })
}

// Update project mutation
export function useUpdateProjectMutation() {
  const mutationFn = useConvexMutation(api.projects.update)
    .withOptimisticUpdate((localStore, args) => {
      // Update project detail cache
      const existingProject = localStore.getQuery(api.projects.getById, { 
        id: args.id, 
        authUserId: args.authUserId 
      })
      
      if (existingProject) {
        const updatedProject = {
          ...existingProject,
          ...args,
          updatedAt: Date.now()
        }
        
        localStore.setQuery(
          api.projects.getById,
          { id: args.id, authUserId: args.authUserId },
          updatedProject
        )
      }

      // Update project list cache
      const projectsList = localStore.getQuery(api.projects.list, { filters: undefined })
      if (projectsList?.data) {
        const updatedList = {
          ...projectsList,
          data: projectsList.data.map(project => 
            project._id === args.id 
              ? { ...project, ...args, updatedAt: Date.now() }
              : project
          )
        }
        localStore.setQuery(api.projects.list, { filters: undefined }, updatedList)
      }
    })

  return useMutation({ mutationFn })
}

// Delete project mutation
export function useDeleteProjectMutation() {
  const mutationFn = useConvexMutation(api.projects.remove)
    .withOptimisticUpdate((localStore, args) => {
      // Remove from project list cache
      const projectsList = localStore.getQuery(api.projects.list, { filters: undefined })
      if (projectsList?.data) {
        const filteredProjects = {
          ...projectsList,
          data: projectsList.data.filter(project => project._id !== args.id)
        }
        localStore.setQuery(api.projects.list, { filters: undefined }, filteredProjects)
      }

      // Remove user projects cache
      const userProjects = localStore.getQuery(api.projects.getUserProjects, { 
        authUserId: args.authUserId || '' 
      })
      if (userProjects?.data) {
        const filteredUserProjects = {
          ...userProjects,
          data: userProjects.data.filter(project => project._id !== args.id)
        }
        localStore.setQuery(
          api.projects.getUserProjects, 
          { authUserId: args.authUserId || '' }, 
          filteredUserProjects
        )
      }
    })

  return useMutation({ mutationFn })
}

// ============================================================================
// AGENT QUERIES & MUTATIONS
// ============================================================================

export const agentQueries = {
  // List agents with filters
  list: (
    projectId?: Id<'projects'>, 
    authUserId?: string,
    filters?: {
      status?: AgentStatus
      role?: AgentRole
      workflowPattern?: WorkflowPattern
    },
    limit?: number,
    offset?: number
  ) => convexQuery(api.agents.list, { projectId, authUserId, filters, limit, offset }),
  
  // Get agent details
  detail: (id: Id<'agents'>, authUserId?: string) =>
    convexQuery(api.agents.getById, { id, authUserId }),
  
  // Get agent performance metrics
  performance: (id: Id<'agents'>, authUserId?: string, timeRange?: number) =>
    convexQuery(api.agents.getPerformanceMetrics, { id, authUserId, timeRange }),
  
  // Get project agent summary
  projectSummary: (projectId: Id<'projects'>, authUserId?: string) =>
    convexQuery(api.agents.getProjectSummary, { projectId, authUserId }),
}

// Create agent mutation
export function useCreateAgentMutation() {
  const mutationFn = useConvexMutation(api.agents.create)
    .withOptimisticUpdate((localStore, args) => {
      const existingAgents = localStore.getQuery(api.agents.list, {
        projectId: args.projectId,
        authUserId: args.authUserId
      })
      
      if (!existingAgents?.data) return

      const optimisticAgent = {
        _id: `temp_${Date.now()}` as Id<'agents'>,
        _creationTime: Date.now(),
        ...args,
        status: 'created' as const,
        performance: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          avgExecutionTime: 0,
          totalTokensUsed: 0,
          totalCostIncurred: 0,
          memoryPeak: 0,
          executionTime: 0,
          recentSuccessRate: 0,
          recentAvgExecutionTime: 0
        },
        lastActiveAt: Date.now(),
        createdBy: args.authUserId || 'system', // Added missing createdBy field
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      localStore.setQuery(
        api.agents.list,
        { projectId: args.projectId, authUserId: args.authUserId },
        {
          ...existingAgents,
          data: [optimisticAgent, ...existingAgents.data]
        }
      )
    })

  return useMutation({ mutationFn })
}

// Update agent mutation
export function useUpdateAgentMutation() {
  const mutationFn = useConvexMutation(api.agents.update)
    .withOptimisticUpdate((localStore, args) => {
      // Update agent detail cache
      const existingAgent = localStore.getQuery(api.agents.getById, {
        id: args.id,
        authUserId: args.authUserId
      })
      
      if (existingAgent) {
        const updatedAgent = {
          ...existingAgent,
          ...args,
          updatedAt: Date.now()
        }
        
        localStore.setQuery(
          api.agents.getById,
          { id: args.id, authUserId: args.authUserId },
          updatedAgent
        )
      }

      // Update agents list cache
      const agentsList = localStore.getQuery(api.agents.list, {
        authUserId: args.authUserId
      })
      
      if (agentsList?.data) {
        const updatedList = {
          ...agentsList,
          data: agentsList.data.map(agent =>
            agent._id === args.id
              ? { ...agent, ...args, updatedAt: Date.now() }
              : agent
          )
        }
        localStore.setQuery(
          api.agents.list,
          { authUserId: args.authUserId },
          updatedList
        )
      }
    })

  return useMutation({ mutationFn })
}

// Delete agent mutation
export function useDeleteAgentMutation() {
  const mutationFn = useConvexMutation(api.agents.remove)
    .withOptimisticUpdate((localStore, args) => {
      const agentsList = localStore.getQuery(api.agents.list, {
        authUserId: args.authUserId
      })
      
      if (agentsList?.data) {
        const filteredAgents = {
          ...agentsList,
          data: agentsList.data.filter(agent => agent._id !== args.id)
        }
        localStore.setQuery(
          api.agents.list,
          { authUserId: args.authUserId },
          filteredAgents
        )
      }
    })

  return useMutation({ mutationFn })
}

// Activate agent mutation
export function useActivateAgentMutation() {
  const mutationFn = useConvexMutation(api.agents.activate)
  return useMutation({ mutationFn })
}

// Deactivate agent mutation
export function useDeactivateAgentMutation() {
  const mutationFn = useConvexMutation(api.agents.deactivate)
  return useMutation({ mutationFn })
}

// Validate agent mutation
export function useValidateAgentMutation() {
  const mutationFn = useConvexMutation(api.agents.validate)
  return useMutation({ mutationFn })
}

// Clone agent mutation
export function useCloneAgentMutation() {
  const mutationFn = useConvexMutation(api.agents.clone)
  return useMutation({ mutationFn })
}

// ============================================================================
// EXECUTION QUERIES & MUTATIONS
// ============================================================================

export const executionQueries = {
  // List executions with filters
  list: (
    projectId?: Id<'projects'>,
    agentId?: Id<'agents'>,
    authUserId?: string,
    filters?: {
      status?: ExecutionStatus
      priority?: PriorityLevel
      createdBy?: string
    },
    limit?: number,
    offset?: number
  ) => convexQuery(api.executions.list, { projectId, agentId, authUserId, filters, limit, offset }),
  
  // List executions with cursor pagination (more efficient)
  listWithCursor: (
    projectId: Id<'projects'>,
    authUserId?: string,
    status?: ExecutionStatus,
    limit?: number,
    cursor?: string
  ) => convexQuery(api.executions.listWithCursor, { projectId, authUserId, status, limit, cursor }),
  
  // Get execution details
  detail: (id: Id<'executions'>, authUserId?: string) =>
    convexQuery(api.executions.getById, { id, authUserId }),
  
  // Get execution logs
  logs: (id: Id<'executions'>, authUserId?: string, severity?: 'low' | 'medium' | 'high' | 'critical', limit?: number) =>
    convexQuery(api.executions.getLogs, { id, authUserId, severity, limit }),
  
  // Get execution metrics
  metrics: (id: Id<'executions'>, authUserId?: string) =>
    convexQuery(api.executions.getMetrics, { id, authUserId }),
  
  // Get queue status
  queueStatus: (projectId?: Id<'projects'>, authUserId?: string) =>
    convexQuery(api.executions.getQueueStatus, { projectId, authUserId }),
}

// Create execution mutation
export function useCreateExecutionMutation() {
  const mutationFn = useConvexMutation(api.executions.create)
    .withOptimisticUpdate((localStore, args) => {
      const existingExecutions = localStore.getQuery(api.executions.list, {
        projectId: args.projectId,
        authUserId: args.authUserId
      })
      
      if (!existingExecutions?.data) return

      const optimisticExecution = {
        _id: `temp_${Date.now()}` as Id<'executions'>,
        _creationTime: Date.now(),
        ...args,
        status: 'pending' as const,
        priority: args.priority || 'normal', // Ensure priority is always set
        progress: {
          currentStep: 0,
          totalSteps: args.workflowDefinition.steps.length,
          percentage: 0,
          completedSteps: [],
          failedSteps: [],
          activeSteps: []
        },
        performance: {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          avgExecutionTime: 0,
          totalTokensUsed: 0,
          totalCostIncurred: 0,
          memoryPeak: 0,
          executionTime: 0,
          recentSuccessRate: 0,
          recentAvgExecutionTime: 0
        },
        createdBy: args.authUserId || 'system', // Added missing createdBy field
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      localStore.setQuery(
        api.executions.list,
        { projectId: args.projectId, authUserId: args.authUserId },
        {
          ...existingExecutions,
          data: [optimisticExecution, ...existingExecutions.data]
        }
      )
    })

  return useMutation({ mutationFn })
}

// Start execution (using wrapper mutation instead of action)
export function useStartExecutionMutation() {
  const mutationFn = useConvexMutation(api.executions.startExecution)
    .withOptimisticUpdate((localStore, args) => {
      // Update execution status optimistically
      const existingExecution = localStore.getQuery(api.executions.getById, {
        id: args.id
      })
      
      if (existingExecution) {
        const updatedExecution = {
          ...existingExecution,
          status: 'running' as ExecutionStatus,
          startedAt: Date.now(),
          updatedAt: Date.now()
        }
        
        localStore.setQuery(
          api.executions.getById,
          { id: args.id },
          updatedExecution
        )
      }

      // Also update the executions list if it's cached
      const executionsList = localStore.getQuery(api.executions.list, {})
      if (executionsList?.data) {
        const updatedList = {
          ...executionsList,
          data: executionsList.data.map(execution =>
            execution._id === args.id
              ? { ...execution, status: 'running' as ExecutionStatus, updatedAt: Date.now() }
              : execution
          )
        }
        localStore.setQuery(api.executions.list, {}, updatedList)
      }
    })

  return useMutation({ 
    mutationFn,
    onSuccess: (data) => {
      console.log('Execution queued for start:', data)
    },
    onError: (error) => {
      console.error('Failed to start execution:', error)
    }
  })
}

// Alternative: Keep the action-based approach for direct execution
export function useStartExecutionAction() {
  const convex = useConvex()
  
  return useMutation({
    mutationFn: async (args: { id: Id<'executions'> }) => {
      return await convex.action(api.executions.start, args)
    },
    onSuccess: (data) => {
      console.log('Execution started directly:', data)
    },
    onError: (error) => {
      console.error('Failed to start execution:', error)
    }
  })
}

// Cancel execution mutation
export function useCancelExecutionMutation() {
  const mutationFn = useConvexMutation(api.executions.cancel)
    .withOptimisticUpdate((localStore, args) => {
      const existingExecution = localStore.getQuery(api.executions.getById, {
        id: args.id,
        authUserId: args.authUserId
      })
      
      if (existingExecution) {
        const cancelledExecution = {
          ...existingExecution,
          status: 'cancelled' as const,
          completedAt: Date.now(),
          updatedAt: Date.now()
        }
        
        localStore.setQuery(
          api.executions.getById,
          { id: args.id, authUserId: args.authUserId },
          cancelledExecution
        )
      }
    })

  return useMutation({ mutationFn })
}

// Retry execution (using direct action call since retry is an action)
export function useRetryExecutionMutation() {
  const convex = useConvex()
  
  return useMutation({
    mutationFn: async (args: { 
      id: Id<'executions'>
      authUserId?: string
      retryFailedStepsOnly?: boolean 
    }) => {
      return await convex.action(api.executions.retry, args)
    },
    onSuccess: (newExecutionId, variables) => {
      console.log('Execution retry created:', { newExecutionId, originalId: variables.id })
    },
    onError: (error) => {
      console.error('Failed to retry execution:', error)
    }
  })
}

// ============================================================================
// USER QUERIES & MUTATIONS
// ============================================================================

export const userQueries = {
  // Get user by auth ID
  byAuthId: (authUserId: string) =>
    convexQuery(api.users.getUserByAuthId, { authUserId }),
  
  // Get user by ID
  detail: (id: Id<'users'>) =>
    convexQuery(api.users.getById, { id }),
  
  // Get user statistics
  stats: (authUserId: string) =>
    convexQuery(api.users.getStats, { authUserId }),
  
  // List all users (admin)
  list: (limit?: number, offset?: number) =>
    convexQuery(api.users.list, { limit, offset }),
}

// Create or update user mutation
export function useCreateOrUpdateUserMutation() {
  const mutationFn = useConvexMutation(api.users.createOrUpdateUser)
  return useMutation({ mutationFn })
}

// Update user preferences mutation
export function useUpdateUserPreferencesMutation() {
  const mutationFn = useConvexMutation(api.users.updatePreferences)
  return useMutation({ mutationFn })
}

// Update user profile mutation
export function useUpdateUserProfileMutation() {
  const mutationFn = useConvexMutation(api.users.updateProfile)
  return useMutation({ mutationFn })
}

// Delete user mutation
export function useDeleteUserMutation() {
  const mutationFn = useConvexMutation(api.users.deleteUser)
  return useMutation({ mutationFn })
}