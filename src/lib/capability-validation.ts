// src/lib/capability-validation.ts

import { z } from 'zod'
import { AGENT_ROLES, WORKFLOW_PATTERNS } from './agent-config'
import { type EnhancedModelInfo, type ModelConfig, getModelById, calculateEstimatedCost } from './model-config'
import type { MemoryConfig } from './memory-management'

// Capability categories and definitions
export const CAPABILITY_CATEGORIES = {
  cognitive: {
    name: 'Cognitive',
    description: 'Reasoning, analysis, and decision-making abilities',
    capabilities: [
      'complex_reasoning',
      'strategic_thinking',
      'problem_solving',
      'pattern_recognition',
      'logical_analysis',
      'creative_thinking'
    ]
  },
  communication: {
    name: 'Communication',
    description: 'Interaction and coordination abilities',
    capabilities: [
      'natural_language_processing',
      'multi_language_support',
      'technical_writing',
      'presentation_skills',
      'negotiation',
      'conflict_resolution'
    ]
  },
  technical: {
    name: 'Technical',
    description: 'Technical skills and tool usage',
    capabilities: [
      'code_generation',
      'system_integration',
      'data_analysis',
      'api_usage',
      'database_management',
      'debugging'
    ]
  },
  management: {
    name: 'Management',
    description: 'Project and resource management abilities',
    capabilities: [
      'project_planning',
      'resource_allocation',
      'timeline_management',
      'quality_assurance',
      'risk_assessment',
      'performance_monitoring'
    ]
  },
  domain_specific: {
    name: 'Domain Specific',
    description: 'Specialized domain knowledge',
    capabilities: [
      'business_analysis',
      'financial_modeling',
      'legal_compliance',
      'marketing_strategy',
      'scientific_research',
      'healthcare_protocols'
    ]
  }
} as const

// Resource requirement calculation factors
export const RESOURCE_FACTORS = {
  role_complexity: {
    planner: 1.5,
    director: 1.8,
    coordinator: 1.3,
    expert: 1.6,
    builder: 1.2
  },
  workflow_pattern_complexity: {
    sequential: 1.0,
    routing: 1.2,
    parallel: 1.4,
    'orchestrator-worker': 1.6,
    'evaluator-optimizer': 1.8,
    'multi-step-tool': 2.0
  },
  capability_complexity: {
    low: 1.0,
    medium: 1.3,
    high: 1.8,
    expert: 2.5
  }
} as const

// Capability validation schema
export const capabilityRequirementSchema = z.object({
  capability: z.string(),
  level: z.enum(['basic', 'intermediate', 'advanced', 'expert']),
  priority: z.enum(['required', 'preferred', 'optional']),
  description: z.string().optional()
})

export const resourceRequirementSchema = z.object({
  minTokens: z.number().positive().optional(),
  maxTokens: z.number().positive().optional(),
  estimatedCost: z.number().positive().optional(),
  memoryRequirement: z.number().positive().optional(),
  computeComplexity: z.enum(['low', 'medium', 'high', 'extreme']),
  concurrency: z.object({
    maxConcurrentTasks: z.number().positive().default(1),
    maxConcurrentRequests: z.number().positive().default(1)
  }).default({
    maxConcurrentTasks: 1,
    maxConcurrentRequests: 1
  })
})

export type CapabilityRequirement = z.infer<typeof capabilityRequirementSchema>
export type ResourceRequirement = z.infer<typeof resourceRequirementSchema>

// Agent validation configuration
export interface AgentValidationConfig {
  role: keyof typeof AGENT_ROLES
  protocol: string
  workflowPattern: keyof typeof WORKFLOW_PATTERNS
  modelConfig: ModelConfig
  memoryConfig: MemoryConfig
  capabilities: string[]
  customCapabilities: string[]
}

// Validation result types
export interface ValidationResult {
  isValid: boolean
  score: number // 0-100
  issues: ValidationIssue[]
  recommendations: Recommendation[]
  resourceRequirements: ResourceRequirement
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info'
  category: 'capability' | 'resource' | 'compatibility' | 'performance'
  message: string
  impact: 'low' | 'medium' | 'high' | 'critical'
  suggestion?: string
}

export interface Recommendation {
  type: 'model' | 'memory' | 'capability' | 'protocol'
  priority: 'low' | 'medium' | 'high'
  description: string
  action: string
  expectedImprovement: number // percentage
}

// Main validation class
export class AgentCapabilityValidator {
  
  async validateAgent(config: AgentValidationConfig): Promise<ValidationResult> {
    const issues: ValidationIssue[] = []
    const recommendations: Recommendation[] = []
    
    // Validate role-protocol compatibility
    this.validateRoleProtocolCompatibility(config, issues, recommendations)
    
    // Validate capabilities for role
    this.validateRoleCapabilities(config, issues, recommendations)
    
    // Validate model suitability
    await this.validateModelSuitability(config, issues, recommendations)
    
    // Validate workflow pattern compatibility
    this.validateWorkflowPatternCompatibility(config, issues, recommendations)
    
    // Validate memory configuration
    await this.validateMemoryConfiguration(config, issues, recommendations)
    
    // Calculate resource requirements
    const resourceRequirements = await this.calculateResourceRequirements(config)
    
    // Calculate overall score
    const score = this.calculateValidationScore(issues, config)
    
    return {
      isValid: issues.filter(i => i.type === 'error').length === 0,
      score,
      issues,
      recommendations,
      resourceRequirements
    }
  }
  
  private validateRoleProtocolCompatibility(
    config: AgentValidationConfig,
    issues: ValidationIssue[],
    recommendations: Recommendation[]
  ) {
    const role = AGENT_ROLES[config.role]
    const availableProtocols = role.defaultProtocols
    
    if (!(availableProtocols as readonly string[]).includes(config.protocol)) {
      issues.push({
        type: 'warning',
        category: 'compatibility',
        message: `Protocol '${config.protocol}' is not typically used with ${config.role} role`,
        impact: 'medium',
        suggestion: `Consider using: ${availableProtocols.join(', ')}`
      })
      
      recommendations.push({
        type: 'protocol',
        priority: 'medium',
        description: 'Use role-appropriate protocol',
        action: `Switch to ${availableProtocols[0]}`,
        expectedImprovement: 15
      })
    }
  }
  
  private validateRoleCapabilities(
    config: AgentValidationConfig,
    issues: ValidationIssue[],
    recommendations: Recommendation[]
  ) {
    const role = AGENT_ROLES[config.role]
    const roleCapabilities = [...role.capabilities]
    const agentCapabilities = [...config.capabilities, ...config.customCapabilities]
    
    // Check for missing core capabilities
    const missingCapabilities = roleCapabilities.filter(cap => 
      !agentCapabilities.some(agentCap => 
        agentCap.includes(cap) || cap.includes(agentCap)
      )
    )
    
    if (missingCapabilities.length > 0) {
      issues.push({
        type: 'warning',
        category: 'capability',
        message: `Missing some core capabilities for ${config.role} role`,
        impact: 'medium',
        suggestion: `Consider adding: ${missingCapabilities.slice(0, 3).join(', ')}`
      })
    }
    
    // Check for irrelevant capabilities
    const allValidCapabilities: string[] = Object.values(CAPABILITY_CATEGORIES)
      .flatMap(cat => [...cat.capabilities] as string[])
    
    const invalidCapabilities = agentCapabilities.filter(cap => 
      !allValidCapabilities.includes(cap) && 
      !config.customCapabilities.includes(cap)
    )
    
    if (invalidCapabilities.length > 0) {
      issues.push({
        type: 'info',
        category: 'capability',
        message: `Some capabilities may not be standard`,
        impact: 'low',
        suggestion: 'Verify custom capabilities are necessary'
      })
    }
  }
  
  private async validateModelSuitability(
    config: AgentValidationConfig,
    issues: ValidationIssue[],
    recommendations: Recommendation[]
  ) {
    const model = await getModelById(config.modelConfig.modelType)
    if (!model) {
      issues.push({
        type: 'error',
        category: 'resource',
        message: 'Invalid model type specified',
        impact: 'critical'
      })
      return
    }
    
    // Check if model has appropriate capabilities for the role
    const roleCapabilities = [...AGENT_ROLES[config.role].capabilities]
    const modelCapabilities = model.capabilities
    
    const missingCapabilities = roleCapabilities.filter(cap => 
      !modelCapabilities.some(modelCap => modelCap.includes(cap) || cap.includes(modelCap))
    )
    
    if (missingCapabilities.length > 0) {
      recommendations.push({
        type: 'model',
        priority: 'medium',
        description: `Current model may not have all capabilities needed for ${config.role} role`,
        action: `Consider a model with: ${missingCapabilities.join(', ')}`,
        expectedImprovement: 15
      })
    }
    
    // Validate token limits
    if (config.modelConfig.parameters.maxTokens > model.maxTokens) {
      issues.push({
        type: 'error',
        category: 'resource',
        message: 'Max tokens exceeds model capability',
        impact: 'critical',
        suggestion: `Reduce max tokens to ${model.maxTokens} or less`
      })
    }
  }
  
  private validateWorkflowPatternCompatibility(
    config: AgentValidationConfig,
    issues: ValidationIssue[],
    recommendations: Recommendation[]
  ) {
    const pattern = WORKFLOW_PATTERNS[config.workflowPattern]
    const role = AGENT_ROLES[config.role]
    
    // Check compatibility matrix
    const incompatibleCombinations = [
      { role: 'builder', pattern: 'orchestrator-worker', reason: 'Builders work best in execution-focused patterns' },
      { role: 'director', pattern: 'sequential', reason: 'Directors are better suited for oversight patterns' }
    ]
    
    const incompatible = incompatibleCombinations.find(combo => 
      combo.role === config.role && combo.pattern === config.workflowPattern
    )
    
    if (incompatible) {
      issues.push({
        type: 'warning',
        category: 'compatibility',
        message: `${config.role} role may not be optimal for ${config.workflowPattern} pattern`,
        impact: 'medium',
        suggestion: incompatible.reason
      })
    }
  }
  
  private async validateMemoryConfiguration(
    config: AgentValidationConfig,
    issues: ValidationIssue[],
    recommendations: Recommendation[]
  ) {
    const model = await getModelById(config.modelConfig.modelType)
    
    if (model && config.memoryConfig.contextWindow > model.contextWindow) {
      issues.push({
        type: 'error',
        category: 'resource',
        message: 'Memory context window exceeds model capability',
        impact: 'critical',
        suggestion: `Reduce context window to ${model.contextWindow} or less`
      })
    }
    
    // Check memory efficiency
    const totalMemorySize = Object.values(config.memoryConfig.memoryTypes)
      .filter(type => type.enabled)
      .reduce((sum, type) => sum + type.maxSize, 0)
      
    if (totalMemorySize > config.memoryConfig.contextWindow * 0.9) {
      recommendations.push({
        type: 'memory',
        priority: 'high',
        description: 'Memory allocation is very high relative to context window',
        action: 'Reduce memory allocation or increase context window',
        expectedImprovement: 25
      })
    }
  }
  
  async calculateResourceRequirements(config: AgentValidationConfig): Promise<ResourceRequirement> {
    const model = await getModelById(config.modelConfig.modelType)
    
    // Base calculations
    const roleComplexity = RESOURCE_FACTORS.role_complexity[config.role]
    const patternComplexity = RESOURCE_FACTORS.workflow_pattern_complexity[config.workflowPattern]
    const capabilityComplexity = this.calculateCapabilityComplexity(config.capabilities)
    
    const complexityMultiplier = roleComplexity * patternComplexity * capabilityComplexity
    
    // Token requirements
    const baseTokens = 1000
    const minTokens = Math.ceil(baseTokens * complexityMultiplier)
    const maxTokens = Math.ceil(minTokens * 3) // Allow for variation
    
    // Cost estimation (per request)
    const avgInputTokens = minTokens
    const avgOutputTokens = config.modelConfig.parameters.maxTokens
    const estimatedCost = model ? calculateEstimatedCost(model, avgInputTokens, avgOutputTokens) : 0
    
    // Memory requirements
    const memoryRequirement = config.memoryConfig.contextWindow
    
    // Compute complexity
    const computeComplexity = this.calculateComputeComplexity(complexityMultiplier)
    
    return {
      minTokens,
      maxTokens,
      estimatedCost,
      memoryRequirement,
      computeComplexity,
      concurrency: {
        maxConcurrentTasks: this.calculateMaxConcurrentTasks(config),
        maxConcurrentRequests: config.modelConfig.rateLimiting.concurrentRequests
      }
    }
  }
  
  private calculateCapabilityComplexity(capabilities: string[]): number {
    const complexCapabilities = [
      'complex_reasoning', 'strategic_thinking', 'system_integration',
      'financial_modeling', 'scientific_research'
    ] as const
    
    const complexCount = capabilities.filter(cap => 
      complexCapabilities.some(complex => cap.includes(complex))
    ).length
    
    const total = capabilities.length
    if (total === 0) return 1.0
    
    const complexRatio = complexCount / total
    return 1.0 + (complexRatio * 1.5) // 1.0 to 2.5 range
  }
  
  private calculateComputeComplexity(multiplier: number): 'low' | 'medium' | 'high' | 'extreme' {
    if (multiplier < 1.5) return 'low'
    if (multiplier < 2.5) return 'medium'
    if (multiplier < 4.0) return 'high'
    return 'extreme'
  }
  
  private calculateMaxConcurrentTasks(config: AgentValidationConfig): number {
    const baseMax = {
      planner: 2,
      director: 3,
      coordinator: 5,
      expert: 3,
      builder: 1
    }
    
    return baseMax[config.role] || 1
  }
  
  private calculateValidationScore(issues: ValidationIssue[], config: AgentValidationConfig): number {
    let score = 100
    
    // Deduct points for issues
    issues.forEach(issue => {
      const deduction = {
        error: { critical: 30, high: 20, medium: 10, low: 5 },
        warning: { critical: 20, high: 15, medium: 8, low: 3 },
        info: { critical: 10, high: 5, medium: 2, low: 1 }
      }[issue.type][issue.impact]
      
      score -= deduction
    })
    
    // Bonus points for good practices
    const roleCapabilities = [...AGENT_ROLES[config.role].capabilities]
    
    // Appropriate capabilities
    const capabilityMatch = config.capabilities.filter(cap => 
      roleCapabilities.some(roleCap => cap.includes(roleCap) || roleCap.includes(cap))
    ).length / roleCapabilities.length
    
    score += Math.ceil(capabilityMatch * 10)
    
    return Math.max(0, Math.min(100, score))
  }
}

// Utility functions
export const validateAgentConfiguration = async (config: AgentValidationConfig): Promise<ValidationResult> => {
  const validator = new AgentCapabilityValidator()
  return await validator.validateAgent(config)
}

export const getCapabilitiesForCategory = (category: keyof typeof CAPABILITY_CATEGORIES): string[] => {
  return [...CAPABILITY_CATEGORIES[category].capabilities]
}

export const getAllCapabilities = (): { category: string; capabilities: string[] }[] => {
  return Object.entries(CAPABILITY_CATEGORIES).map(([key, value]) => ({
    category: key,
    capabilities: [...value.capabilities]
  }))
}

export const estimateResourceUsage = async (
  config: AgentValidationConfig,
  tasksPerDay: number = 10
): Promise<{
  dailyTokens: number
  dailyCost: number
  memoryUsage: number
}> => {
  const validator = new AgentCapabilityValidator()
  const requirements = await validator.calculateResourceRequirements(config)
  
  const avgTokensPerTask = ((requirements.minTokens || 1000) + (requirements.maxTokens || 3000)) / 2
  const dailyTokens = avgTokensPerTask * tasksPerDay
  const dailyCost = (requirements.estimatedCost || 0) * tasksPerDay
  
  return {
    dailyTokens,
    dailyCost,
    memoryUsage: requirements.memoryRequirement || 0
  }
}