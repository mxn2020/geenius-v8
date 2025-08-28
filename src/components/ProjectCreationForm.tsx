// src/components/ProjectCreationForm.tsx - Project Creation Form Component

import { useState } from 'react'
import { X, Info, AlertCircle, CheckCircle } from 'lucide-react'
import { z } from 'zod'
import { ProjectFormData } from '~/types/exports'

// Project creation schema
const projectCreationSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  configuration: z.object({
    defaultTimeout: z.number().min(10000).max(7200000), // 10s to 2h
    maxConcurrentExecutions: z.number().min(1).max(100),
    errorHandling: z.enum(['fail-fast', 'continue', 'retry-all'])
  }),
  resourceLimits: z.object({
    maxTokensPerExecution: z.number().min(100).max(1000000),
    maxCostPerExecution: z.number().min(0.01).max(100),
    maxExecutionTime: z.number().min(60000).max(7200000) // 1min to 2h
  }),
  template: z.enum(['blank', 'data-analysis', 'content-generation', 'workflow-automation', 'custom']).optional(),
  metadata: z.record(z.string(), z.any()).optional()
})

type ProjectCreationData = z.infer<typeof projectCreationSchema>

interface ProjectCreationFormProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: ProjectFormData) => Promise<void>
  isLoading?: boolean
}

interface ProjectTemplate {
  id: string
  name: string
  description: string
  icon: string
  defaultConfig: Partial<ProjectCreationData>
}

const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Project',
    description: 'Start with a clean slate and configure everything yourself',
    icon: '📄',
    defaultConfig: {
      configuration: {
        defaultTimeout: 1800000, // 30 minutes
        maxConcurrentExecutions: 5,
        errorHandling: 'fail-fast'
      },
      resourceLimits: {
        maxTokensPerExecution: 10000,
        maxCostPerExecution: 1.0,
        maxExecutionTime: 1800000
      }
    }
  },
  {
    id: 'data-analysis',
    name: 'Data Analysis',
    description: 'Optimized for data processing and analytical workflows',
    icon: '📊',
    defaultConfig: {
      configuration: {
        defaultTimeout: 3600000, // 1 hour
        maxConcurrentExecutions: 3,
        errorHandling: 'retry-all'
      },
      resourceLimits: {
        maxTokensPerExecution: 50000,
        maxCostPerExecution: 5.0,
        maxExecutionTime: 3600000
      }
    }
  },
  {
    id: 'content-generation',
    name: 'Content Generation',
    description: 'Perfect for creative writing and content creation tasks',
    icon: '✍️',
    defaultConfig: {
      configuration: {
        defaultTimeout: 900000, // 15 minutes
        maxConcurrentExecutions: 8,
        errorHandling: 'continue'
      },
      resourceLimits: {
        maxTokensPerExecution: 25000,
        maxCostPerExecution: 2.0,
        maxExecutionTime: 1800000
      }
    }
  },
  {
    id: 'workflow-automation',
    name: 'Workflow Automation',
    description: 'Designed for automated business process workflows',
    icon: '⚙️',
    defaultConfig: {
      configuration: {
        defaultTimeout: 2700000, // 45 minutes
        maxConcurrentExecutions: 10,
        errorHandling: 'fail-fast'
      },
      resourceLimits: {
        maxTokensPerExecution: 15000,
        maxCostPerExecution: 3.0,
        maxExecutionTime: 2700000
      }
    }
  },
  {
    id: 'custom',
    name: 'Custom Template',
    description: 'Configure advanced settings and custom parameters',
    icon: '🔧',
    defaultConfig: {
      configuration: {
        defaultTimeout: 1800000,
        maxConcurrentExecutions: 5,
        errorHandling: 'fail-fast'
      },
      resourceLimits: {
        maxTokensPerExecution: 20000,
        maxCostPerExecution: 2.0,
        maxExecutionTime: 1800000
      }
    }
  }
]

export function ProjectCreationForm({ isOpen, onClose, onSubmit, isLoading = false }: ProjectCreationFormProps) {
  const [step, setStep] = useState(1)
  const [selectedTemplate, setSelectedTemplate] = useState<string>('blank')
  const [formData, setFormData] = useState<ProjectCreationData>({
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
    template: 'blank'
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validateStep = (stepNumber: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (stepNumber === 1) {
      if (!formData.name.trim()) {
        newErrors.name = 'Project name is required'
      } else if (formData.name.length > 100) {
        newErrors.name = 'Name must be less than 100 characters'
      }

      if (formData.description && formData.description.length > 500) {
        newErrors.description = 'Description must be less than 500 characters'
      }
    }

    if (stepNumber === 3) {
      // Validate configuration
      if (formData.configuration.defaultTimeout < 10000 || formData.configuration.defaultTimeout > 7200000) {
        newErrors['configuration.defaultTimeout'] = 'Timeout must be between 10 seconds and 2 hours'
      }

      if (formData.configuration.maxConcurrentExecutions < 1 || formData.configuration.maxConcurrentExecutions > 100) {
        newErrors['configuration.maxConcurrentExecutions'] = 'Concurrent executions must be between 1 and 100'
      }

      // Validate resource limits
      if (formData.resourceLimits.maxTokensPerExecution < 100 || formData.resourceLimits.maxTokensPerExecution > 1000000) {
        newErrors['resourceLimits.maxTokensPerExecution'] = 'Max tokens must be between 100 and 1,000,000'
      }

      if (formData.resourceLimits.maxCostPerExecution < 0.01 || formData.resourceLimits.maxCostPerExecution > 100) {
        newErrors['resourceLimits.maxCostPerExecution'] = 'Max cost must be between $0.01 and $100'
      }

      if (formData.resourceLimits.maxExecutionTime < 60000 || formData.resourceLimits.maxExecutionTime > 7200000) {
        newErrors['resourceLimits.maxExecutionTime'] = 'Max execution time must be between 1 minute and 2 hours'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(step + 1)
    }
  }

  const handleBack = () => {
    setStep(step - 1)
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = PROJECT_TEMPLATES.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplate(templateId)
      setFormData({
        ...formData,
        ...template.defaultConfig,
        template: templateId as any
      })
    }
  }

  const handleSubmit = async () => {
    if (validateStep(step)) {
      try {
        await onSubmit(formData)
        // Reset form on success
        setStep(1)
        setFormData({
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
          template: 'blank'
        })
        setSelectedTemplate('blank')
        setErrors({})
        onClose()
      } catch (error) {
        setErrors({ submit: (error as Error).message })
      }
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Create New Project</h2>
            <p className="text-sm text-gray-600 mt-1">
              Step {step} of 3: {
                step === 1 ? 'Basic Information' :
                step === 2 ? 'Choose Template' : 
                'Configuration'
              }
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            disabled={isLoading}
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(step / 3) * 100}%` }}
            ></div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Step 1: Basic Information */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter project name..."
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
                  placeholder="Describe your project... (optional)"
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

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info size={16} className="text-blue-600 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <strong>What is a project?</strong>
                    <p className="mt-1">
                      A project is a container for your AI agents, workflows, and executions. 
                      It helps organize your work and provides centralized configuration and monitoring.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Template Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Choose a Template</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Templates provide pre-configured settings optimized for different use cases.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PROJECT_TEMPLATES.map((template) => (
                  <div
                    key={template.id}
                    className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${
                      selectedTemplate === template.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{template.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{template.name}</h4>
                          {selectedTemplate === template.id && (
                            <CheckCircle size={16} className="text-blue-600" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {template.description}
                        </p>
                        
                        {/* Template preview */}
                        <div className="mt-3 text-xs text-gray-500 space-y-1">
                          <div>Timeout: {formatDuration(template.defaultConfig.configuration?.defaultTimeout || 0)}</div>
                          <div>Max concurrent: {template.defaultConfig.configuration?.maxConcurrentExecutions}</div>
                          <div>Max cost: {formatCurrency(template.defaultConfig.resourceLimits?.maxCostPerExecution || 0)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <strong>Note:</strong> You can modify these settings in the next step or later in project settings.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Configuration */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Project Configuration</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Fine-tune the settings for your project based on the selected template.
                </p>
              </div>

              {/* Execution Configuration */}
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Execution Settings</h4>
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
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors['configuration.defaultTimeout'] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      disabled={isLoading}
                    >
                      <option value={600000}>10 minutes</option>
                      <option value={900000}>15 minutes</option>
                      <option value={1800000}>30 minutes</option>
                      <option value={2700000}>45 minutes</option>
                      <option value={3600000}>1 hour</option>
                      <option value={7200000}>2 hours</option>
                    </select>
                    {errors['configuration.defaultTimeout'] && (
                      <p className="mt-1 text-sm text-red-600">{errors['configuration.defaultTimeout']}</p>
                    )}
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
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors['configuration.maxConcurrentExecutions'] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      disabled={isLoading}
                    />
                    {errors['configuration.maxConcurrentExecutions'] && (
                      <p className="mt-1 text-sm text-red-600">{errors['configuration.maxConcurrentExecutions']}</p>
                    )}
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
                <h4 className="font-medium text-gray-900 mb-3">Resource Limits</h4>
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
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors['resourceLimits.maxTokensPerExecution'] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      disabled={isLoading}
                    />
                    {errors['resourceLimits.maxTokensPerExecution'] && (
                      <p className="mt-1 text-sm text-red-600">{errors['resourceLimits.maxTokensPerExecution']}</p>
                    )}
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
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors['resourceLimits.maxCostPerExecution'] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      disabled={isLoading}
                    />
                    {errors['resourceLimits.maxCostPerExecution'] && (
                      <p className="mt-1 text-sm text-red-600">{errors['resourceLimits.maxCostPerExecution']}</p>
                    )}
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
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors['resourceLimits.maxExecutionTime'] ? 'border-red-500' : 'border-gray-300'
                      }`}
                      disabled={isLoading}
                    >
                      <option value={300000}>5 minutes</option>
                      <option value={600000}>10 minutes</option>
                      <option value={1800000}>30 minutes</option>
                      <option value={3600000}>1 hour</option>
                      <option value={7200000}>2 hours</option>
                    </select>
                    {errors['resourceLimits.maxExecutionTime'] && (
                      <p className="mt-1 text-sm text-red-600">{errors['resourceLimits.maxExecutionTime']}</p>
                    )}
                  </div>
                </div>
              </div>

              {errors.submit && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={16} className="text-red-600 mt-0.5" />
                    <div className="text-sm text-red-800">
                      <strong>Error:</strong> {errors.submit}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200">
          <div className="flex gap-2">
            {step > 1 && (
              <button
                onClick={handleBack}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                disabled={isLoading}
              >
                Back
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            
            {step < 3 ? (
              <button
                onClick={handleNext}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                disabled={isLoading}
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                disabled={isLoading}
              >
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                )}
                Create Project
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}