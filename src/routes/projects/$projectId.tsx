// src/routes/projects/$projectId.tsx - Updated for new backend
import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { projectQueries, useUpdateProjectMutation, useDeleteProjectMutation } from '~/queries'
import { Loader } from '~/components/Loader'
import { ProjectSettingsModal } from '~/components/ProjectSettingsModal'
import { useState } from 'react'
import { useSession } from '~/lib/auth-client'
import type { Id } from '../../convex/_generated/dataModel'
import type { ProjectFormData, ProjectStatus } from '~/types/index'

export const Route = createFileRoute('/projects/$projectId')({
  component: ProjectDetailPage,
  pendingComponent: () => <Loader />,
})

function ProjectDetailPage() {
  const { projectId } = Route.useParams()
  const { data: session } = useSession()
  const navigate = useNavigate()
  const [showSettings, setShowSettings] = useState(false)

  // Get project details using new backend
  const projectQuery = useSuspenseQuery(
    projectQueries.detail(projectId as Id<'projects'>, session?.user?.id)
  )
  
  // Mutations
  const updateProjectMutation = useUpdateProjectMutation()
  const deleteProjectMutation = useDeleteProjectMutation()

  const project = projectQuery.data

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Project not found</h2>
          <p className="text-gray-600 mb-4">The project you're looking for doesn't exist or you don't have access to it.</p>
          <Link 
            to="/projects" 
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Back to Projects
          </Link>
        </div>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    const statusColors = {
      active: 'bg-green-100 text-green-800',
      paused: 'bg-yellow-100 text-yellow-800', 
      completed: 'bg-blue-100 text-blue-800',
      archived: 'bg-gray-100 text-gray-800'
    }
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800'
  }

  const handleSaveProjectSettings = async (projectId: string, settings: ProjectFormData) => {
    try {
      await updateProjectMutation.mutateAsync({
        id: projectId as Id<'projects'>,
        authUserId: session?.user?.id,
        name: settings.name,
        description: settings.description,
        configuration: settings.configuration,
        resourceLimits: settings.resourceLimits,
        metadata: settings.metadata,
      })
      setShowSettings(false)
    } catch (error) {
      console.error('Failed to update project:', error)
      throw error
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProjectMutation.mutateAsync({ 
        id: projectId as Id<'projects'>,
        authUserId: session?.user?.id
      })
      navigate({ to: '/projects' })
    } catch (error) {
      console.error('Failed to delete project:', error)
      throw error
    }
  }

  const handleArchiveProject = async (projectId: string) => {
    try {
      await updateProjectMutation.mutateAsync({
        id: projectId as Id<'projects'>,
        authUserId: session?.user?.id,
        status: 'archived'
      })
      setShowSettings(false)
    } catch (error) {
      console.error('Failed to archive project:', error)
      throw error
    }
  }

  const handleStatusChange = async (projectId: string, status: ProjectStatus) => {
    try {
      await updateProjectMutation.mutateAsync({
        id: projectId as Id<'projects'>,
        authUserId: session?.user?.id,
        status
      })
    } catch (error) {
      console.error('Failed to update project status:', error)
      throw error
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <Link 
                  to="/projects" 
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  ← Back to Projects
                </Link>
              </div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(project.status)}`}>
                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                </span>
              </div>
              {project.description && (
                <p className="text-gray-600 mt-2">{project.description}</p>
              )}
            </div>
            <button
              onClick={() => setShowSettings(true)}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
            >
              Settings
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Executions</p>
                <p className="text-2xl font-bold text-gray-900">{project.statistics?.totalExecutions || 0}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Successful</p>
                <p className="text-2xl font-bold text-green-600">{project.statistics?.successfulExecutions || 0}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{project.statistics?.failedExecutions || 0}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tokens Used</p>
                <p className="text-2xl font-bold text-purple-600">{(project.statistics?.totalTokensUsed || 0).toLocaleString()}</p>
              </div>
              <div className="p-3 bg-purple-100 rounded-lg">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cost</p>
                <p className="text-2xl font-bold text-orange-600">${(project.statistics?.totalCostIncurred || 0).toFixed(2)}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-lg">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Configuration</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-600">Default Timeout:</span>
                <span className="ml-2 text-gray-900">{project.configuration?.defaultTimeout || 0}ms</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Max Concurrent Executions:</span>
                <span className="ml-2 text-gray-900">{project.configuration?.maxConcurrentExecutions || 0}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Error Handling:</span>
                <span className="ml-2 px-2 py-1 bg-gray-100 rounded text-sm text-gray-900">
                  {project.configuration?.errorHandling || 'Not configured'}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Resource Limits</h2>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-600">Max Tokens per Execution:</span>
                <span className="ml-2 text-gray-900">{(project.resourceLimits?.maxTokensPerExecution || 0).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Max Cost per Execution:</span>
                <span className="ml-2 text-gray-900">${(project.resourceLimits?.maxCostPerExecution || 0).toFixed(2)}</span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Max Execution Time:</span>
                <span className="ml-2 text-gray-900">{project.resourceLimits?.maxExecutionTime || 0}ms</span>
              </div>
            </div>
          </div>
        </div>

        {/* Agent Management Section */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Agents & Executions</h2>
            <div className="flex gap-2">
              <Link
                to="/agents"
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Manage Agents
              </Link>
              <Link
                to="/executions"
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm"
              >
                View Executions
              </Link>
            </div>
          </div>
          <div className="text-center py-12 text-gray-500">
            <p>Agent management and execution monitoring will be available in the next implementation step.</p>
            <p className="text-sm mt-2">You can manage agents and view executions using the buttons above.</p>
          </div>
        </div>

        {/* Settings Modal */}
        {showSettings && (
          <ProjectSettingsModal
            project={project}
            isOpen={showSettings}
            onClose={() => setShowSettings(false)}
            onSave={handleSaveProjectSettings}
            onDelete={handleDeleteProject}
            onArchive={handleArchiveProject}
            onStatusChange={handleStatusChange}
            isLoading={updateProjectMutation.isPending || deleteProjectMutation.isPending}
          />
        )}
      </div>
    </div>
  )
}