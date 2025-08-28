// src/components/ProjectDashboard.tsx - Project Dashboard Component

import { useState, useMemo } from 'react'
import { Plus, Search, Filter, Archive, Settings, Trash2, Play, Pause, Users, Activity, DollarSign, Clock, Grid, List, ChevronDown, ChevronUp, SortAsc, SortDesc, X, Calendar, TrendingUp } from 'lucide-react'
import { useRealtimeProjectList, useRealtimeSystemHealth } from '~/lib/realtime-subscriptions'
import { ProjectCreationForm } from './ProjectCreationForm'
import { ProjectSettingsModal } from './ProjectSettingsModal'
import { Project, ProjectStatus, SortField, SortOrder, ViewMode, ProjectFormData } from '~/types/exports'

// Project interface is now imported from ~/types

export function ProjectDashboard() {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<ProjectStatus>('all')
  const [sortBy, setSortBy] = useState<SortField>('updated')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  
  // Additional filter states
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [costFilter, setCostFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all')
  const [executionFilter, setExecutionFilter] = useState<'all' | 'none' | 'few' | 'many'>('all')

  // Get real-time project data
  const { projects, isLoading } = useRealtimeProjectList()
  const { health } = useRealtimeSystemHealth()

  // Filter and search projects
  const filteredProjects = useMemo(() => {
    if (!projects) return []

    let filtered = projects.filter((project: Project) => {
      // Text search
      const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           project.description?.toLowerCase().includes(searchQuery.toLowerCase())
      
      // Status filter
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter
      
      // Date filter
      let matchesDate = true
      if (dateFilter !== 'all') {
        const now = Date.now()
        const projectDate = project.updatedAt
        switch (dateFilter) {
          case 'today':
            matchesDate = now - projectDate < 86400000 // 24 hours
            break
          case 'week':
            matchesDate = now - projectDate < 604800000 // 7 days
            break
          case 'month':
            matchesDate = now - projectDate < 2592000000 // 30 days
            break
        }
      }
      
      // Cost filter
      let matchesCost = true
      if (costFilter !== 'all') {
        const cost = project.statistics.totalCostIncurred
        switch (costFilter) {
          case 'low':
            matchesCost = cost < 10
            break
          case 'medium':
            matchesCost = cost >= 10 && cost < 50
            break
          case 'high':
            matchesCost = cost >= 50
            break
        }
      }
      
      // Execution filter
      let matchesExecutions = true
      if (executionFilter !== 'all') {
        const executions = project.statistics.totalExecutions
        switch (executionFilter) {
          case 'none':
            matchesExecutions = executions === 0
            break
          case 'few':
            matchesExecutions = executions > 0 && executions <= 10
            break
          case 'many':
            matchesExecutions = executions > 10
            break
        }
      }
      
      return matchesSearch && matchesStatus && matchesDate && matchesCost && matchesExecutions
    })

    // Sort projects
    filtered.sort((a: Project, b: Project) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'created':
          comparison = a.createdAt - b.createdAt
          break
        case 'updated':
          comparison = a.updatedAt - b.updatedAt
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'cost':
          comparison = a.statistics.totalCostIncurred - b.statistics.totalCostIncurred
          break
        case 'executions':
          comparison = a.statistics.totalExecutions - b.statistics.totalExecutions
          break
      }
      
      return sortOrder === 'desc' ? -comparison : comparison
    })

    return filtered
  }, [projects, searchQuery, statusFilter, dateFilter, costFilter, executionFilter, sortBy, sortOrder])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (!projects) return { total: 0, active: 0, paused: 0, completed: 0 }

    return projects.reduce((acc: any, project: Project) => {
      acc.total += 1
      acc[project.status] = (acc[project.status] || 0) + 1
      return acc
    }, { total: 0, active: 0, paused: 0, completed: 0, archived: 0 })
  }, [projects])

  const handleOpenCreateModal = () => {
    setShowCreateModal(true)
  }

  const handleProjectAction = (project: Project, action: string) => {
    setSelectedProject(project)
    
    switch (action) {
      case 'settings':
        setShowSettingsModal(true)
        break
      case 'pause':
        // TODO: Implement pause project
        console.log('Pause project:', project._id)
        break
      case 'resume':
        // TODO: Implement resume project  
        console.log('Resume project:', project._id)
        break
      case 'archive':
        // TODO: Implement archive project
        console.log('Archive project:', project._id)
        break
      case 'delete':
        // TODO: Implement delete project
        console.log('Delete project:', project._id)
        break
    }
  }

  const handleCreateProject = async (projectData: ProjectFormData) => {
    try {
      // TODO: Integrate with Convex backend
      console.log('Creating project:', projectData)
      
      // For now, just log the data
      // In the future: await createProject(projectData)
      
      // Close modal
      setShowCreateModal(false)
    } catch (error) {
      console.error('Failed to create project:', error)
      throw error
    }
  }

  const handleSaveProjectSettings = async (projectId: string, settings: ProjectFormData) => {
    try {
      // TODO: Integrate with Convex backend
      console.log('Updating project settings:', projectId, settings)
      
      // For now, just log the data
      // In the future: await updateProject(projectId, settings)
    } catch (error) {
      console.error('Failed to update project:', error)
      throw error
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      // TODO: Integrate with Convex backend
      console.log('Deleting project:', projectId)
      
      // For now, just log the data
      // In the future: await deleteProject(projectId)
    } catch (error) {
      console.error('Failed to delete project:', error)
      throw error
    }
  }

  const handleArchiveProject = async (projectId: string) => {
    try {
      // TODO: Integrate with Convex backend
      console.log('Archiving project:', projectId)
      
      // For now, just log the data
      // In the future: await archiveProject(projectId)
    } catch (error) {
      console.error('Failed to archive project:', error)
      throw error
    }
  }

  const handleStatusChange = async (projectId: string, status: Project['status']) => {
    try {
      // TODO: Integrate with Convex backend
      console.log('Changing project status:', projectId, status)
      
      // For now, just log the data
      // In the future: await updateProjectStatus(projectId, status)
    } catch (error) {
      console.error('Failed to change project status:', error)
      throw error
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4
    }).format(amount)
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50'
      case 'paused': return 'text-yellow-600 bg-yellow-50'
      case 'completed': return 'text-blue-600 bg-blue-50'
      case 'archived': return 'text-gray-600 bg-gray-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600">Manage and monitor your AI agent projects</p>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          Create Project
        </button>
      </div>

      {/* System Health Banner */}
      {health && health.overall !== 'healthy' && (
        <div className={`mb-6 p-4 rounded-lg ${
          health.overall === 'critical' ? 'bg-red-50 border-red-200' :
          health.overall === 'degraded' ? 'bg-yellow-50 border-yellow-200' :
          'bg-gray-50 border-gray-200'
        } border`}>
          <div className="flex items-center gap-2">
            <Activity size={18} className={
              health.overall === 'critical' ? 'text-red-600' :
              health.overall === 'degraded' ? 'text-yellow-600' :
              'text-gray-600'
            } />
            <span className="font-medium">
              System Status: {health.overall.charAt(0).toUpperCase() + health.overall.slice(1)}
            </span>
            <span className="text-sm text-gray-600">
              • {health.activeAgents} active agents • {health.runningExecutions} running executions
            </span>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Projects</p>
              <p className="text-2xl font-bold text-gray-900">{summaryStats.total}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity size={20} className="text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active</p>
              <p className="text-2xl font-bold text-green-600">{summaryStats.active || 0}</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <Play size={20} className="text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Paused</p>
              <p className="text-2xl font-bold text-yellow-600">{summaryStats.paused || 0}</p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Pause size={20} className="text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-blue-600">{summaryStats.completed || 0}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Archive size={20} className="text-blue-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4 mb-6">
        {/* Top row - Search, Sort, View Mode */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search projects by name or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Controls */}
          <div className="flex gap-2">
            {/* Sort */}
            <div className="relative">
              <select
                value={`${sortBy}_${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('_')
                  setSortBy(field as any)
                  setSortOrder(order as 'asc' | 'desc')
                }}
                className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
              >
                <option value="updated_desc">Recently Updated</option>
                <option value="created_desc">Recently Created</option>
                <option value="name_asc">Name A-Z</option>
                <option value="name_desc">Name Z-A</option>
                <option value="cost_desc">Highest Cost</option>
                <option value="cost_asc">Lowest Cost</option>
                <option value="executions_desc">Most Executions</option>
                <option value="executions_asc">Fewest Executions</option>
              </select>
            </div>

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-colors ${
                showFilters 
                  ? 'bg-blue-50 border-blue-200 text-blue-700' 
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter size={16} />
              Filters
              {showFilters ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {/* View Mode Toggle */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${
                  viewMode === 'grid' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Grid size={16} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${
                  viewMode === 'list' 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ProjectStatus)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>

              {/* Cost Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost Range</label>
                <select
                  value={costFilter}
                  onChange={(e) => setCostFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  <option value="all">Any Cost</option>
                  <option value="low">Low (&lt; $10)</option>
                  <option value="medium">Medium ($10-$50)</option>
                  <option value="high">High (&gt; $50)</option>
                </select>
              </div>

              {/* Execution Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Execution Count</label>
                <select
                  value={executionFilter}
                  onChange={(e) => setExecutionFilter(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white text-sm"
                >
                  <option value="all">Any Count</option>
                  <option value="none">No Executions</option>
                  <option value="few">Few (1-10)</option>
                  <option value="many">Many (&gt; 10)</option>
                </select>
              </div>
            </div>

            {/* Active Filters & Clear */}
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
              <div className="text-sm text-gray-600">
                {filteredProjects.length} project{filteredProjects.length !== 1 ? 's' : ''} found
              </div>
              
              {(statusFilter !== 'all' || dateFilter !== 'all' || costFilter !== 'all' || executionFilter !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setStatusFilter('all')
                    setDateFilter('all')
                    setCostFilter('all')
                    setExecutionFilter('all')
                    setSearchQuery('')
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Projects Display */}
      <div className={viewMode === 'grid' 
        ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
        : "space-y-4"
      }>
        {filteredProjects.map((project: Project) => {
          if (viewMode === 'list') {
            // List View Layout
            return (
              <div key={project._id} className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-center p-4">
                  {/* Project Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {project.name}
                      </h3>
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                        {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                      </span>
                    </div>
                    {project.description && (
                      <p className="text-sm text-gray-600 mb-2 line-clamp-1">
                        {project.description}
                      </p>
                    )}
                    
                    {/* Compact Metrics */}
                    <div className="flex items-center gap-6 text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Activity size={14} />
                        <span>{project.statistics.totalExecutions} executions</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <DollarSign size={14} />
                        <span>{formatCurrency(project.statistics.totalCostIncurred)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Success Rate */}
                  <div className="mx-4 min-w-0 w-24">
                    <div className="text-xs text-gray-500 mb-1 text-center">Success Rate</div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all" 
                        style={{
                          width: `${project.statistics.totalExecutions > 0 
                            ? (project.statistics.successfulExecutions / project.statistics.totalExecutions) * 100
                            : 0
                          }%`
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1 text-center">
                      {project.statistics.totalExecutions > 0 
                        ? Math.round((project.statistics.successfulExecutions / project.statistics.totalExecutions) * 100)
                        : 0
                      }%
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button className="px-3 py-1 text-sm text-blue-600 border border-blue-200 rounded hover:bg-blue-50 transition-colors">
                      View Details
                    </button>
                    <button className="px-3 py-1 text-sm text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors">
                      Run
                    </button>
                    <button
                      onClick={() => handleProjectAction(project, 'settings')}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      title="Settings"
                    >
                      <Settings size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          }
          
          // Grid View Layout (existing design)
          return (
            <div key={project._id} className="bg-white rounded-lg border border-gray-200 hover:shadow-lg transition-shadow">
              {/* Project Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {project.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 ml-2">
                    <button
                      onClick={() => handleProjectAction(project, 'settings')}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      title="Settings"
                    >
                      <Settings size={16} />
                    </button>
                    
                    {project.status === 'active' && (
                      <button
                        onClick={() => handleProjectAction(project, 'pause')}
                        className="p-1 text-gray-400 hover:text-yellow-600 rounded"
                        title="Pause"
                      >
                        <Pause size={16} />
                      </button>
                    )}
                    
                    {project.status === 'paused' && (
                      <button
                        onClick={() => handleProjectAction(project, 'resume')}
                        className="p-1 text-gray-400 hover:text-green-600 rounded"
                        title="Resume"
                      >
                        <Play size={16} />
                      </button>
                    )}
                    
                    <button
                      onClick={() => handleProjectAction(project, 'archive')}
                      className="p-1 text-gray-400 hover:text-blue-600 rounded"
                      title="Archive"
                    >
                      <Archive size={16} />
                    </button>
                    
                    <button
                      onClick={() => handleProjectAction(project, 'delete')}
                      className="p-1 text-gray-400 hover:text-red-600 rounded"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                    {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                  </span>
                  <span className="text-xs text-gray-500">
                    Updated {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Project Metrics */}
              <div className="p-4">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Activity size={14} className="text-gray-500" />
                      <span className="text-xs text-gray-500">Executions</span>
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                      {project.statistics.totalExecutions}
                    </div>
                    <div className="text-xs text-gray-500">
                      {project.statistics.successfulExecutions} success
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <DollarSign size={14} className="text-gray-500" />
                      <span className="text-xs text-gray-500">Cost</span>
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(project.statistics.totalCostIncurred)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {project.statistics.totalTokensUsed.toLocaleString()} tokens
                    </div>
                  </div>
                </div>

                {/* Success Rate Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Success Rate</span>
                    <span>
                      {project.statistics.totalExecutions > 0 
                        ? Math.round((project.statistics.successfulExecutions / project.statistics.totalExecutions) * 100)
                        : 0
                      }%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full transition-all" 
                      style={{
                        width: `${project.statistics.totalExecutions > 0 
                          ? (project.statistics.successfulExecutions / project.statistics.totalExecutions) * 100
                          : 0
                        }%`
                      }}
                    ></div>
                  </div>
                </div>

                {/* Configuration Info */}
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatDuration(project.configuration.defaultTimeout)}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users size={12} />
                    {project.configuration.maxConcurrentExecutions} concurrent
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="px-4 pb-4">
                <div className="flex gap-2">
                  <button className="flex-1 px-3 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors">
                    View Details
                  </button>
                  <button className="flex-1 px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
                    Run Execution
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Activity size={32} className="text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery || statusFilter !== 'all' ? 'No projects found' : 'No projects yet'}
          </h3>
          <p className="text-gray-600 mb-4">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by creating your first AI agent project'
            }
          </p>
          {(!searchQuery && statusFilter === 'all') && (
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={18} />
              Create Your First Project
            </button>
          )}
        </div>
      )}

      {/* Project Creation Modal */}
      <ProjectCreationForm 
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateProject}
        isLoading={false}
      />

      {/* Project Settings Modal */}
      <ProjectSettingsModal
        project={selectedProject}
        isOpen={showSettingsModal}
        onClose={() => {
          setShowSettingsModal(false)
          setSelectedProject(null)
        }}
        onSave={handleSaveProjectSettings}
        onDelete={handleDeleteProject}
        onArchive={handleArchiveProject}
        onStatusChange={handleStatusChange}
        isLoading={false}
      />
    </div>
  )
}