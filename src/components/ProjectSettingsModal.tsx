// src/components/ProjectSettingsModal.tsx - Project Settings Management Modal

import { useState, useEffect } from 'react'
import { X, Save, AlertTriangle, Info, Trash2, Archive, RefreshCw } from 'lucide-react'
import { z } from 'zod'
import { Project, ProjectFormData } from '~/types/index'

// Project settings schema
const projectSettingsSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  configuration: z.object({
    defaultTimeout: z.number().min(10000).max(7200000),
    maxConcurrentExecutions: z.number().min(1).max(100),
    errorHandling: z.enum(['fail-fast', 'continue', 'retry-all'])
  }),
  resourceLimits: z.object({
    maxTokensPerExecution: z.number().min(100).max(1000000),
    maxCostPerExecution: z.number().min(0.01).max(100),
    maxExecutionTime: z.number().min(60000).max(7200000)
  }),
  notifications: z.object({
    enableEmailNotifications: z.boolean().default(true),
    enableSlackNotifications: z.boolean().default(false),
    notifyOnFailure: z.boolean().default(true),
    notifyOnCompletion: z.boolean().default(false),
    notifyOnCostThreshold: z.boolean().default(true),
    costThreshold: z.number().min(1).max(1000).default(50)
  }).default({
    enableEmailNotifications: true,
    enableSlackNotifications: false,
    notifyOnFailure: true,
    notifyOnCompletion: false,
    notifyOnCostThreshold: true,
    costThreshold: 50
  }),
  advanced: z.object({
    retentionDays: z.number().min(1).max(365).default(30),
    enableDebugLogs: z.boolean().default(false),
    enablePerformanceMetrics: z.boolean().default(true),
    customMetadata: z.record(z.string(), z.any()).default({})
  }).default({
    retentionDays: 30,
    enableDebugLogs: false,
    enablePerformanceMetrics: true,
    customMetadata: {}
  })
})

type ProjectSettingsData = z.infer<typeof projectSettingsSchema>

interface ProjectSettingsModalProps {
  project: Project | null
  isOpen: boolean
  onClose: () => void
  onSave: (projectId: string, settings: ProjectFormData) => Promise<void>
  onDelete?: (projectId: string) => Promise<void>
  onArchive?: (projectId: string) => Promise<void>
  onStatusChange?: (projectId: string, status: Project['status']) => Promise<void>
  isLoading?: boolean
}

export function ProjectSettingsModal({
  project,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onArchive,
  onStatusChange,
  isLoading = false
}: ProjectSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'general' | 'configuration' | 'notifications' | 'advanced'>('general')
  const [formData, setFormData] = useState<ProjectSettingsData>({
    name: '',
    description: '',
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
    notifications: {
      enableEmailNotifications: true,
      enableSlackNotifications: false,
      notifyOnFailure: true,
      notifyOnCompletion: false,
      notifyOnCostThreshold: true,
      costThreshold: 50
    },
    advanced: {
      retentionDays: 30,
      enableDebugLogs: false,
      enablePerformanceMetrics: true,
      customMetadata: {}
    }
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)

  // Load project data when modal opens
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name,
        description: project.description || '',
        configuration: project.configuration,
        resourceLimits: project.resourceLimits,
        notifications: project.metadata?.notifications || {
          enableEmailNotifications: true,
          enableSlackNotifications: false,
          notifyOnFailure: true,
          notifyOnCompletion: false,
          notifyOnCostThreshold: true,
          costThreshold: 50
        },
        advanced: project.metadata?.advanced || {
          retentionDays: 30,
          enableDebugLogs: false,
          enablePerformanceMetrics: true,
          customMetadata: {}
        }
      })
    }
  }, [project])

  const validateForm = (): boolean => {
    try {
      projectSettingsSchema.parse(formData)
      setErrors({})
      return true
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {}
        error.issues.forEach((err) => {
          if (err.path.length > 0) {
            newErrors[err.path.join('.')] = err.message
          }
        })
        setErrors(newErrors)
      }
      return false
    }
  }

  const handleSave = async () => {
    if (!project || !validateForm()) return

    try {
      await onSave(project._id, formData)
      onClose()
    } catch (error) {
      setErrors({ submit: (error as Error).message })
    }
  }

  const handleStatusChange = async (newStatus: Project['status']) => {
    if (!project || !onStatusChange) return
    
    try {
      await onStatusChange(project._id, newStatus)
    } catch (error) {
      setErrors({ status: (error as Error).message })
    }
  }

  const handleDelete = async () => {
    if (!project || !onDelete) return
    
    try {
      await onDelete(project._id)
      onClose()
    } catch (error) {
      setErrors({ delete: (error as Error).message })
    }
  }

  const handleArchive = async () => {
    if (!project || !onArchive) return
    
    try {
      await onArchive(project._id)
      onClose()
    } catch (error) {
      setErrors({ archive: (error as Error).message })
    }
  }

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    return `${minutes}m`
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount)
  }

  if (!isOpen || !project) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Project Settings</h2>
            <p className="text-sm text-gray-600 mt-1">{project.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex px-6">
            {[
              { id: 'general', label: 'General' },
              { id: 'configuration', label: 'Configuration' },
              { id: 'notifications', label: 'Notifications' },
              { id: 'advanced', label: 'Advanced' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isLoading}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    errors.description ? 'border-red-500' : 'border-gray-300'
                  }`}
                  disabled={isLoading}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  {(formData.description || '').length}/500 characters
                </p>
              </div>

              {/* Project Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Status
                </label>
                <div className="flex gap-2">
                  {project.status === 'paused' && (
                    <button
                      onClick={() => handleStatusChange('active')}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-green-600 border border-green-200 rounded-lg hover:bg-green-50"
                      disabled={isLoading}
                    >
                      <RefreshCw size={14} />
                      Resume Project
                    </button>
                  )}
                  
                  {project.status === 'active' && (
                    <button
                      onClick={() => handleStatusChange('paused')}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-yellow-600 border border-yellow-200 rounded-lg hover:bg-yellow-50"
                      disabled={isLoading}
                    >
                      Pause Project
                    </button>
                  )}
                </div>
              </div>

              {errors.status && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{errors.status}</p>
                </div>
              )}
            </div>
          )}

          {/* Configuration Tab */}
          {activeTab === 'configuration' && (
            <div className="space-y-6">
              {/* Execution Settings */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Execution Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Default Timeout
                    </label>
                    <select
                      value={formData.configuration.defaultTimeout}
                      onChange={(e) => setFormData({
                        ...formData,
                        configuration: {
                          ...formData.configuration,
                          defaultTimeout: parseInt(e.target.value)
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isLoading}
                    >
                      <option value={600000}>10 minutes</option>
                      <option value={900000}>15 minutes</option>
                      <option value={1800000}>30 minutes</option>
                      <option value={2700000}>45 minutes</option>
                      <option value={3600000}>1 hour</option>
                      <option value={7200000}>2 hours</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Concurrent Executions
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formData.configuration.maxConcurrentExecutions}
                      onChange={(e) => setFormData({
                        ...formData,
                        configuration: {
                          ...formData.configuration,
                          maxConcurrentExecutions: parseInt(e.target.value) || 1
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Error Handling Strategy
                    </label>
                    <select
                      value={formData.configuration.errorHandling}
                      onChange={(e) => setFormData({
                        ...formData,
                        configuration: {
                          ...formData.configuration,
                          errorHandling: e.target.value as 'fail-fast' | 'continue' | 'retry-all'
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isLoading}
                    >
                      <option value="fail-fast">Fail Fast - Stop on first error</option>
                      <option value="continue">Continue - Skip failed steps</option>
                      <option value="retry-all">Retry All - Retry failed steps</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Resource Limits */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Resource Limits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Tokens per Execution
                    </label>
                    <input
                      type="number"
                      min="100"
                      max="1000000"
                      step="1000"
                      value={formData.resourceLimits.maxTokensPerExecution}
                      onChange={(e) => setFormData({
                        ...formData,
                        resourceLimits: {
                          ...formData.resourceLimits,
                          maxTokensPerExecution: parseInt(e.target.value) || 100
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isLoading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Cost per Execution ($)
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.10"
                      value={formData.resourceLimits.maxCostPerExecution}
                      onChange={(e) => setFormData({
                        ...formData,
                        resourceLimits: {
                          ...formData.resourceLimits,
                          maxCostPerExecution: parseFloat(e.target.value) || 0.01
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Max Execution Time
                    </label>
                    <select
                      value={formData.resourceLimits.maxExecutionTime}
                      onChange={(e) => setFormData({
                        ...formData,
                        resourceLimits: {
                          ...formData.resourceLimits,
                          maxExecutionTime: parseInt(e.target.value)
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isLoading}
                    >
                      <option value={300000}>5 minutes</option>
                      <option value={600000}>10 minutes</option>
                      <option value={1800000}>30 minutes</option>
                      <option value={3600000}>1 hour</option>
                      <option value={7200000}>2 hours</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Notification Preferences</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Email Notifications</label>
                      <p className="text-xs text-gray-500">Receive notifications via email</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.notifications.enableEmailNotifications}
                      onChange={(e) => setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          enableEmailNotifications: e.target.checked
                        }
                      })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Slack Notifications</label>
                      <p className="text-xs text-gray-500">Send notifications to Slack</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.notifications.enableSlackNotifications}
                      onChange={(e) => setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          enableSlackNotifications: e.target.checked
                        }
                      })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      disabled={isLoading}
                    />
                  </div>

                  <hr className="my-4" />

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Notify on Failure</label>
                      <p className="text-xs text-gray-500">Alert when executions fail</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.notifications.notifyOnFailure}
                      onChange={(e) => setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          notifyOnFailure: e.target.checked
                        }
                      })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Notify on Completion</label>
                      <p className="text-xs text-gray-500">Alert when executions complete successfully</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.notifications.notifyOnCompletion}
                      onChange={(e) => setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          notifyOnCompletion: e.target.checked
                        }
                      })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Cost Threshold Alerts</label>
                      <p className="text-xs text-gray-500">Alert when costs exceed threshold</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.notifications.notifyOnCostThreshold}
                      onChange={(e) => setFormData({
                        ...formData,
                        notifications: {
                          ...formData.notifications,
                          notifyOnCostThreshold: e.target.checked
                        }
                      })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      disabled={isLoading}
                    />
                  </div>

                  {formData.notifications.notifyOnCostThreshold && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cost Threshold ($)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={formData.notifications.costThreshold}
                        onChange={(e) => setFormData({
                          ...formData,
                          notifications: {
                            ...formData.notifications,
                            costThreshold: parseInt(e.target.value) || 1
                          }
                        })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        disabled={isLoading}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Advanced Tab */}
          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Advanced Settings</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Data Retention (days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formData.advanced.retentionDays}
                      onChange={(e) => setFormData({
                        ...formData,
                        advanced: {
                          ...formData.advanced,
                          retentionDays: parseInt(e.target.value) || 1
                        }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      disabled={isLoading}
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      How long to keep execution logs and results
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Enable Debug Logs</label>
                      <p className="text-xs text-gray-500">Include detailed debug information in logs</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.advanced.enableDebugLogs}
                      onChange={(e) => setFormData({
                        ...formData,
                        advanced: {
                          ...formData.advanced,
                          enableDebugLogs: e.target.checked
                        }
                      })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      disabled={isLoading}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Performance Metrics</label>
                      <p className="text-xs text-gray-500">Collect detailed performance metrics</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={formData.advanced.enablePerformanceMetrics}
                      onChange={(e) => setFormData({
                        ...formData,
                        advanced: {
                          ...formData.advanced,
                          enablePerformanceMetrics: e.target.checked
                        }
                      })}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      disabled={isLoading}
                    />
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div>
                <h3 className="text-lg font-medium text-red-600 mb-4">Danger Zone</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle size={20} className="text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-red-800">Archive Project</h4>
                      <p className="text-sm text-red-700 mt-1">
                        Archive this project to hide it from active projects. You can restore it later.
                      </p>
                      <button
                        onClick={() => setShowArchiveConfirm(true)}
                        className="mt-2 flex items-center gap-2 px-3 py-1 text-sm text-red-700 border border-red-300 rounded hover:bg-red-100"
                        disabled={isLoading}
                      >
                        <Archive size={14} />
                        Archive Project
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-red-200 pt-3">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={20} className="text-red-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-red-800">Delete Project</h4>
                        <p className="text-sm text-red-700 mt-1">
                          Permanently delete this project. This action cannot be undone.
                        </p>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="mt-2 flex items-center gap-2 px-3 py-1 text-sm text-red-700 border border-red-300 rounded hover:bg-red-100"
                          disabled={isLoading}
                        >
                          <Trash2 size={14} />
                          Delete Project
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error Display */}
          {(errors.submit || errors.delete || errors.archive) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-600 mt-0.5" />
                <div className="text-sm text-red-800">
                  <strong>Error:</strong> {errors.submit || errors.delete || errors.archive}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            <Info size={14} className="inline mr-1" />
            Changes will take effect immediately
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              )}
              <Save size={16} />
              Save Changes
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-full">
                  <Trash2 size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Delete Project</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-sm text-gray-700 mb-6">
                Are you sure you want to permanently delete "{project.name}"? 
                All executions, logs, and data will be lost.
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  disabled={isLoading}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Archive Confirmation Modal */}
        {showArchiveConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-full">
                  <Archive size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Archive Project</h3>
                  <p className="text-sm text-gray-600">Project will be hidden from active view</p>
                </div>
              </div>
              
              <p className="text-sm text-gray-700 mb-6">
                Are you sure you want to archive "{project.name}"? 
                You can restore it later from the archived projects view.
              </p>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="flex-1 px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchive}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  disabled={isLoading}
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}