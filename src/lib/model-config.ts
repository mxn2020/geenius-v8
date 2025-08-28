// src/lib/model-config.ts

import { z } from 'zod'
import { gateway } from '@ai-sdk/gateway'

// Import the actual type from the AI Gateway SDK
import type { GatewayLanguageModelEntry } from '@ai-sdk/gateway'

// Gateway model interface (using the actual SDK type)
export type GatewayModel = GatewayLanguageModelEntry

// Enhanced model info with additional metadata
export interface EnhancedModelInfo {
  // Core properties from GatewayLanguageModelEntry
  id: string
  name: string
  description?: string | null
  pricing?: {
    input: string
    output: string
    cachedInputTokens?: string
    cacheCreationInputTokens?: string
  } | null
  
  // Enhanced properties with defaults for missing gateway properties
  maxTokens: number
  contextWindow: number
  capabilities: string[]
  recommendedFor: string[]
  provider: string
  costPer1kTokens: { input: number; output: number }
}

// Model capability mappings based on provider patterns

// Estimate max tokens based on model ID patterns
const estimateMaxTokens = (modelId: string): number => {
  if (modelId.includes('gpt-4o') || modelId.includes('claude') || modelId.includes('o1') || modelId.includes('o3')) {
    return 8192
  }
  if (modelId.includes('gemini') || modelId.includes('grok')) {
    return 8192
  }
  if (modelId.includes('nova') || modelId.includes('llama')) {
    return 4096
  }
  return 4096 // conservative default
}

// Estimate context window based on model ID patterns
const estimateContextWindow = (modelId: string): number => {
  if (modelId.includes('claude-3') || modelId.includes('gpt-4')) {
    return 200000
  }
  if (modelId.includes('gemini-2') || modelId.includes('grok-3')) {
    return 128000
  }
  if (modelId.includes('llama-3') || modelId.includes('mistral')) {
    return 128000
  }
  if (modelId.includes('nova') || modelId.includes('qwen')) {
    return 64000
  }
  return 32768 // conservative default
}
const getModelCapabilities = (modelId: string, modelName: string, description?: string): string[] => {
  const capabilities: string[] = ['text']
  
  // Vision capabilities
  if (modelId.includes('gpt-4') || modelId.includes('claude-3') || modelId.includes('gemini') || 
      modelId.includes('nova') || description?.toLowerCase().includes('multimodal') ||
      description?.toLowerCase().includes('vision') || description?.toLowerCase().includes('image')) {
    capabilities.push('vision')
  }
  
  // Function calling
  if (modelId.includes('gpt') || modelId.includes('claude') || modelId.includes('gemini')) {
    capabilities.push('function_calling')
  }
  
  // JSON mode
  if (modelId.includes('gpt-4')) {
    capabilities.push('json_mode')
  }
  
  // Code capabilities
  if (modelId.includes('coder') || modelName.toLowerCase().includes('coder') || 
      description?.toLowerCase().includes('code') || description?.toLowerCase().includes('coding')) {
    capabilities.push('code_generation', 'system_integration')
  }
  
  // Audio/video for Gemini
  if (modelId.includes('gemini')) {
    capabilities.push('audio', 'video')
  }
  
  // Artifacts for Claude
  if (modelId.includes('claude') && modelId.includes('sonnet')) {
    capabilities.push('artifacts')
  }
  
  return capabilities
}

// Model use case recommendations based on model characteristics
const getModelRecommendations = (modelId: string, contextWindow: number, pricing?: { input: string; output: string }): string[] => {
  const recommendations: string[] = []
  
  // Cost-based recommendations
  if (pricing) {
    const inputCost = parseFloat(pricing.input)
    const outputCost = parseFloat(pricing.output)
    
    if (inputCost < 0.0001 && outputCost < 0.0005) {
      recommendations.push('cost_effective', 'high_volume', 'fast_response')
    } else if (inputCost > 0.01 || outputCost > 0.05) {
      recommendations.push('highest_quality', 'critical_tasks', 'complex_analysis')
    }
  }
  
  // Context window based
  if (contextWindow > 100000) {
    recommendations.push('large_context', 'comprehensive_analysis')
  }
  
  // Model-specific recommendations
  if (modelId.includes('gpt-4o')) {
    recommendations.push('complex_reasoning', 'multimodal_tasks', 'function_calling')
  } else if (modelId.includes('claude')) {
    recommendations.push('complex_reasoning', 'code_generation', 'analysis')
  } else if (modelId.includes('gemini')) {
    recommendations.push('multimodal', 'comprehensive_analysis')
  } else if (modelId.includes('coder')) {
    recommendations.push('code_generation', 'technical_tasks', 'system_integration')
  } else if (modelId.includes('nova')) {
    recommendations.push('fast_response', 'multimodal_tasks')
  }
  
  return recommendations.length > 0 ? recommendations : ['general_purpose']
}

// Convert gateway model to enhanced model info
const enhanceGatewayModel = (model: GatewayModel): EnhancedModelInfo => {
  const provider = model.id.split('/')[0] || 'unknown'
  
  // Estimate token limits based on model patterns (since gateway doesn't provide this)
  const maxTokens = estimateMaxTokens(model.id)
  const contextWindow = estimateContextWindow(model.id)
  
  return {
    // Copy core properties
    id: model.id,
    name: model.name,
    description: model.description || undefined,
    pricing: model.pricing,
    
    // Add enhanced properties with estimates
    maxTokens,
    contextWindow,
    provider,
    capabilities: getModelCapabilities(model.id, model.name, model.description || undefined),
    recommendedFor: getModelRecommendations(model.id, contextWindow, model.pricing || undefined),
    costPer1kTokens: {
      input: model.pricing ? parseFloat(model.pricing.input) * 1000 : 0,
      output: model.pricing ? parseFloat(model.pricing.output) * 1000 : 0
    }
  }
}

// Cache for models to avoid frequent API calls
let modelCache: {
  models: EnhancedModelInfo[]
  timestamp: number
  ttl: number
} | null = null

const MODEL_CACHE_TTL = 1000 * 60 * 15 // 15 minutes

// Get available models from Vercel AI Gateway
export const getAvailableModels = async (forceRefresh = false): Promise<EnhancedModelInfo[]> => {
  // Check cache first
  if (!forceRefresh && modelCache && (Date.now() - modelCache.timestamp) < modelCache.ttl) {
    return modelCache.models
  }
  
  try {
    const result = await gateway.getAvailableModels()
    
    // Get language models and enhance them (assuming all returned models are language models)
    const languageModels = result.models
      .map(enhanceGatewayModel)
    
    // Update cache
    modelCache = {
      models: languageModels,
      timestamp: Date.now(),
      ttl: MODEL_CACHE_TTL
    }
    
    return languageModels
  } catch (error) {
    console.error('Failed to fetch models from AI Gateway:', error)
    
    // Return empty array or cached models if available
    return modelCache?.models || []
  }
}

// Get specific model by ID
export const getModelById = async (modelId: string): Promise<EnhancedModelInfo | null> => {
  const models = await getAvailableModels()
  return models.find(model => model.id === modelId) || null
}

// Get models by provider
export const getModelsByProvider = async (provider: string): Promise<EnhancedModelInfo[]> => {
  const models = await getAvailableModels()
  return models.filter(model => model.provider === provider)
}

// Model parameter configurations
export const MODEL_PARAMETERS = {
  temperature: {
    name: 'Temperature',
    description: 'Controls randomness in responses (0.0 = deterministic, 1.0 = creative)',
    min: 0,
    max: 1,
    default: 0.7,
    step: 0.1
  },
  topP: {
    name: 'Top P',
    description: 'Nucleus sampling parameter (0.1 = focused, 1.0 = diverse)',
    min: 0,
    max: 1,
    default: 0.9,
    step: 0.05
  },
  maxTokens: {
    name: 'Max Tokens',
    description: 'Maximum tokens in the response',
    min: 1,
    max: 8192,
    default: 1000,
    step: 1
  },
  presencePenalty: {
    name: 'Presence Penalty',
    description: 'Penalty for token presence (reduces repetition)',
    min: -2,
    max: 2,
    default: 0,
    step: 0.1
  },
  frequencyPenalty: {
    name: 'Frequency Penalty', 
    description: 'Penalty for token frequency (reduces repetition)',
    min: -2,
    max: 2,
    default: 0,
    step: 0.1
  }
} as const

// Model configuration schema
export const modelConfigSchema = z.object({
  modelType: z.string().min(1, 'Model type is required'),
  parameters: z.object({
    temperature: z.number().min(0).max(1).default(0.7),
    topP: z.number().min(0).max(1).default(0.9).optional(),
    maxTokens: z.number().min(1).max(8192).default(1000),
    presencePenalty: z.number().min(-2).max(2).default(0).optional(),
    frequencyPenalty: z.number().min(-2).max(2).default(0).optional(),
    systemPrompt: z.string().optional(),
    stopSequences: z.array(z.string()).optional(),
  }).default({
    temperature: 0.7,
    maxTokens: 1000
  }),
  tokenLimit: z.number().positive().optional(),
  costLimit: z.number().positive().optional(),
  rateLimiting: z.object({
    requestsPerMinute: z.number().positive().optional(),
    tokensPerMinute: z.number().positive().optional(),
    concurrentRequests: z.number().positive().default(1),
  }).default({
    concurrentRequests: 1
  })
})

export type ModelConfig = z.infer<typeof modelConfigSchema>

// Helper functions
export const getModelInfo = async (modelId: string): Promise<EnhancedModelInfo | null> => {
  return await getModelById(modelId)
}

export const calculateEstimatedCost = (
  model: EnhancedModelInfo,
  inputTokens: number,
  outputTokens: number
): number => {
  const inputCost = (inputTokens / 1000) * model.costPer1kTokens.input
  const outputCost = (outputTokens / 1000) * model.costPer1kTokens.output
  return inputCost + outputCost
}

// Get recommended models for agent roles (async to work with dynamic models)
export const getRecommendedModelsForRole = async (role: string): Promise<string[]> => {
  const models = await getAvailableModels()
  
  // Role-based model preferences with fallbacks
  const rolePreferences = {
    planner: ['claude', 'gpt-4o', 'gemini'],
    director: ['claude-3-opus', 'gpt-4o', 'claude'],
    coordinator: ['claude', 'gpt-4o-mini', 'gemini-flash'],
    expert: ['claude', 'gpt-4o', 'qwen3-coder'],
    builder: ['qwen3-coder', 'claude', 'gpt-4o']
  }
  
  const preferences = rolePreferences[role as keyof typeof rolePreferences] || ['gpt-4o']
  const recommendedModels: string[] = []
  
  // Find models that match preferences
  for (const preference of preferences) {
    const matchingModels = models.filter(model => 
      model.id.includes(preference) || 
      model.name.toLowerCase().includes(preference.toLowerCase())
    )
    
    // Add best matches based on capabilities and cost
    if (matchingModels.length > 0) {
      // Sort by cost-effectiveness (lower cost per token is better)
      const sorted = matchingModels.sort((a, b) => {
        const aCost = a.costPer1kTokens.input + a.costPer1kTokens.output
        const bCost = b.costPer1kTokens.input + b.costPer1kTokens.output
        return aCost - bCost
      })
      
      recommendedModels.push(sorted[0].id)
    }
  }
  
  // Fallback to top 3 models if no preferences match
  if (recommendedModels.length === 0) {
    const fallbackModels = models
      .sort((a, b) => {
        // Sort by a combination of capabilities and reasonable cost
        const aScore = a.capabilities.length - (a.costPer1kTokens.input + a.costPer1kTokens.output) * 100
        const bScore = b.capabilities.length - (b.costPer1kTokens.input + b.costPer1kTokens.output) * 100
        return bScore - aScore
      })
      .slice(0, 3)
      .map(model => model.id)
    
    return fallbackModels
  }
  
  return recommendedModels.slice(0, 3) // Return top 3
}

// Validate model configuration against actual model capabilities
export const validateModelConfig = async (config: ModelConfig) => {
  const model = await getModelById(config.modelType)
  const errors: string[] = []
  
  if (!model) {
    errors.push(`Model "${config.modelType}" not found in available models`)
    return { isValid: false, errors }
  }
  
  // Validate max tokens against model limits
  if (model.maxTokens && config.parameters.maxTokens > model.maxTokens) {
    errors.push(`Max tokens (${config.parameters.maxTokens}) exceeds model limit (${model.maxTokens})`)
  }
  
  // Validate token limit if set
  if (config.tokenLimit && model.contextWindow && config.tokenLimit > model.contextWindow) {
    errors.push(`Token limit (${config.tokenLimit}) exceeds model context window (${model.contextWindow})`)
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    model
  }
}

// Get default model configuration for a role (async to work with dynamic models)
export const getDefaultModelConfigForRole = async (role: string): Promise<ModelConfig> => {
  const recommendedModels = await getRecommendedModelsForRole(role)
  const defaultModel = recommendedModels[0] || 'openai/gpt-4o' // Fallback to a common model
  
  const roleDefaults = {
    planner: { temperature: 0.8, maxTokens: 2000 },
    director: { temperature: 0.3, maxTokens: 1500 },
    coordinator: { temperature: 0.5, maxTokens: 1000 },
    expert: { temperature: 0.4, maxTokens: 2000 },
    builder: { temperature: 0.2, maxTokens: 1500 }
  }
  
  const defaults = roleDefaults[role as keyof typeof roleDefaults] || { temperature: 0.7, maxTokens: 1000 }
  
  return {
    modelType: defaultModel,
    parameters: {
      temperature: defaults.temperature,
      topP: 0.9,
      maxTokens: defaults.maxTokens,
      presencePenalty: 0,
      frequencyPenalty: 0
    },
    rateLimiting: {
      concurrentRequests: 1
    }
  }
}

// Sync version for backwards compatibility (uses cached models)
export const getDefaultModelConfigForRoleSync = (role: string): ModelConfig => {
  // Use cached models if available, otherwise fallback
  const cachedModels = modelCache?.models || []
  let defaultModel = 'openai/gpt-4o' // Safe fallback
  
  if (cachedModels.length > 0) {
    // Simple role-based selection from cached models
    const rolePreferences = {
      planner: 'claude',
      director: 'claude',
      coordinator: 'gpt-4o-mini',
      expert: 'claude', 
      builder: 'coder'
    }
    
    const preference = rolePreferences[role as keyof typeof rolePreferences] || 'gpt-4o'
    const preferredModel = cachedModels.find(model => model.id.includes(preference))
    
    if (preferredModel) {
      defaultModel = preferredModel.id
    }
  }
  
  const roleDefaults = {
    planner: { temperature: 0.8, maxTokens: 2000 },
    director: { temperature: 0.3, maxTokens: 1500 },
    coordinator: { temperature: 0.5, maxTokens: 1000 },
    expert: { temperature: 0.4, maxTokens: 2000 },
    builder: { temperature: 0.2, maxTokens: 1500 }
  }
  
  const defaults = roleDefaults[role as keyof typeof roleDefaults] || { temperature: 0.7, maxTokens: 1000 }
  
  return {
    modelType: defaultModel,
    parameters: {
      temperature: defaults.temperature,
      topP: 0.9,
      maxTokens: defaults.maxTokens,
      presencePenalty: 0,
      frequencyPenalty: 0
    },
    rateLimiting: {
      concurrentRequests: 1
    }
  }
}