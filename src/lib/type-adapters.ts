// src/lib/type-adapters.ts - Type adapters to bridge Convex data and frontend types

import type { Id } from '../../convex/_generated/dataModel'
import type { Project } from '~/types/index'

// Define the actual Convex project type based on the schema
type ConvexProject = {
  _id: Id<'projects'>
  _creationTime: number
  name: string
  description?: string
  status: 'active' | 'paused' | 'completed' | 'archived'
  config?: {
    defaultModelConfig?: {
      modelType: string
      parameters?: any
      tokenLimit?: number
      costLimit?: number
    }
    templates?: string[]
    settings?: any
  }
  configuration?: {
    defaultTimeout: number
    maxConcurrentExecutions: number
    errorHandling: 'fail-fast' | 'continue' | 'retry-all'
  }
  resourceLimits?: {
    maxTokensPerExecution: number
    maxCostPerExecution: number
    maxExecutionTime: number
  }
  statistics?: {
    totalExecutions: number
    successfulExecutions: number
    failedExecutions: number
    totalTokensUsed: number
    totalCostIncurred: number
  }
  createdBy: string
  createdAt: number
  updatedAt: number
  metadata?: Record<string, any>
}

// Adapter function to convert Convex project to frontend Project type
export function adaptConvexProjectToProject(convexProject: ConvexProject): Project {
  return {
    _id: convexProject._id,
    _creationTime: convexProject._creationTime,
    name: convexProject.name,
    description: convexProject.description,
    status: convexProject.status,
    createdAt: convexProject.createdAt,
    updatedAt: convexProject.updatedAt,
    createdBy: convexProject.createdBy,
    statistics: convexProject.statistics || {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      totalTokensUsed: 0,
      totalCostIncurred: 0,
    },
    configuration: convexProject.configuration || {
      defaultTimeout: 1800000,
      maxConcurrentExecutions: 5,
      errorHandling: 'fail-fast',
    },
    resourceLimits: convexProject.resourceLimits || {
      maxTokensPerExecution: 100000,
      maxCostPerExecution: 1.0,
      maxExecutionTime: 3600000,
    },
    metadata: convexProject.metadata || {},
  }
}

// Adapter for arrays of projects
export function adaptConvexProjectsToProjects(convexProjects: ConvexProject[]): Project[] {
  return convexProjects.map(adaptConvexProjectToProject)
}

export type { ConvexProject }