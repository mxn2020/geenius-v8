// src/lib/execution-engine.ts

import { z } from 'zod'
import { logger, agentLogger } from './logging-system'
import { performanceCollector, trackExecution } from './performance-metrics'
import { tokenTracker } from './token-tracking'
import { auditSystem } from './audit-system'
import { realtimeMonitor, startExecutionTracking } from './realtime-monitoring'
import { WORKFLOW_PATTERNS, AGENT_ROLES } from './agent-config'
import { getAvailableModels } from './model-config'

// Execution context schema
export const executionContextSchema = z.object({
  executionId: z.string(),
  projectId: z.string(),
  userId: z.string().optional(),
  
  // Workflow definition
  workflow: z.object({
    name: z.string(),
    pattern: z.enum(['sequential', 'routing', 'parallel', 'orchestrator-worker', 'evaluator-optimizer', 'multi-step-tool']),
    description: z.string().optional(),
    agents: z.array(z.object({
      agentId: z.string(),
      role: z.enum(['planner', 'director', 'coordinator', 'expert', 'builder']),
      config: z.record(z.string(), z.any()),
      dependencies: z.array(z.string()).default([])
    })),
    steps: z.array(z.object({
      id: z.string(),
      name: z.string(),
      agentId: z.string(),
      input: z.record(z.string(), z.any()).optional(),
      condition: z.string().optional(), // For conditional routing
      retry: z.object({
        maxAttempts: z.number().default(3),
        backoffMs: z.number().default(1000)
      }).optional()
    }))
  }),
  
  // Input data
  input: z.record(z.string(), z.any()).default({}),
  
  // Execution configuration
  config: z.object({
    timeout: z.number().default(1800000), // 30 minutes
    maxConcurrency: z.number().default(5),
    errorHandling: z.enum(['fail-fast', 'continue', 'retry-all']).default('fail-fast'),
    saveIntermediateResults: z.boolean().default(true)
  }).default({
    timeout: 1800000,
    maxConcurrency: 5,
    errorHandling: 'fail-fast',
    saveIntermediateResults: true
  }),
  
  metadata: z.record(z.string(), z.any()).default({})
})

export type ExecutionContext = z.infer<typeof executionContextSchema>

// Execution state schema
export const executionStateSchema = z.object({
  executionId: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'timeout']),
  
  // Progress tracking
  progress: z.object({
    currentStep: z.number().default(0),
    totalSteps: z.number(),
    percentage: z.number().min(0).max(1),
    completedSteps: z.array(z.string()).default([]),
    failedSteps: z.array(z.string()).default([]),
    activeSteps: z.array(z.string()).default([])
  }),
  
  // Timing
  timing: z.object({
    startedAt: z.number(),
    completedAt: z.number().optional(),
    duration: z.number().optional(),
    estimatedCompletion: z.number().optional()
  }),
  
  // Results
  results: z.object({
    stepResults: z.record(z.string(), z.any()).default({}),
    finalResult: z.any().optional(),
    intermediateOutputs: z.array(z.object({
      stepId: z.string(),
      timestamp: z.number(),
      output: z.any(),
      metadata: z.record(z.string(), z.any()).default({})
    })).default([])
  }),
  
  // Error tracking
  errors: z.array(z.object({
    stepId: z.string(),
    timestamp: z.number(),
    error: z.object({
      name: z.string(),
      message: z.string(),
      stack: z.string().optional(),
      code: z.string().optional()
    }),
    retry: z.object({
      attempt: z.number(),
      maxAttempts: z.number(),
      nextRetryAt: z.number().optional()
    }).optional()
  })).default([]),
  
  // Resource usage
  resources: z.object({
    totalTokensUsed: z.number().default(0),
    totalCostIncurred: z.number().default(0),
    peakMemoryUsage: z.number().default(0),
    agentUsage: z.record(z.string(), z.object({
      tokens: z.number(),
      cost: z.number(),
      executionTime: z.number()
    })).default({})
  }),
  
  metadata: z.record(z.string(), z.any()).default({})
})

export type ExecutionState = z.infer<typeof executionStateSchema>

// Step execution result
export const stepResultSchema = z.object({
  stepId: z.string(),
  agentId: z.string(),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
  
  // Execution details
  execution: z.object({
    startedAt: z.number(),
    completedAt: z.number().optional(),
    duration: z.number().optional(),
    retryAttempt: z.number().default(0)
  }),
  
  // Input/Output
  input: z.any(),
  output: z.any().optional(),
  
  // Performance metrics
  performance: z.object({
    tokensUsed: z.number().default(0),
    cost: z.number().default(0),
    memoryUsage: z.number().optional(),
    modelCalls: z.number().default(0)
  }),
  
  // Error details
  error: z.object({
    name: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    recoverable: z.boolean().default(true)
  }).optional(),
  
  metadata: z.record(z.string(), z.any()).default({})
})

export type StepResult = z.infer<typeof stepResultSchema>

// Execution engine configuration
export const executionEngineConfigSchema = z.object({
  // Processing limits
  limits: z.object({
    maxConcurrentExecutions: z.number().default(10),
    maxStepsPerExecution: z.number().default(100),
    maxExecutionTime: z.number().default(3600000), // 1 hour
    maxMemoryPerExecution: z.number().default(1073741824) // 1GB
  }).default({
    maxConcurrentExecutions: 10,
    maxStepsPerExecution: 100,
    maxExecutionTime: 3600000,
    maxMemoryPerExecution: 1073741824
  }),
  
  // Retry configuration
  retryConfig: z.object({
    defaultMaxAttempts: z.number().default(3),
    defaultBackoffMs: z.number().default(1000),
    maxBackoffMs: z.number().default(60000),
    exponentialBackoff: z.boolean().default(true)
  }).default({
    defaultMaxAttempts: 3,
    defaultBackoffMs: 1000,
    maxBackoffMs: 60000,
    exponentialBackoff: true
  }),
  
  // Storage configuration
  storage: z.object({
    persistIntermediateResults: z.boolean().default(true),
    resultRetentionDays: z.number().default(30),
    compressResults: z.boolean().default(true)
  }).default({
    persistIntermediateResults: true,
    resultRetentionDays: 30,
    compressResults: true
  }),
  
  // Monitoring
  monitoring: z.object({
    enableMetrics: z.boolean().default(true),
    enableAuditLog: z.boolean().default(true),
    enableRealTimeUpdates: z.boolean().default(true),
    metricsInterval: z.number().default(5000) // 5 seconds
  }).default({
    enableMetrics: true,
    enableAuditLog: true,
    enableRealTimeUpdates: true,
    metricsInterval: 5000
  })
})

export type ExecutionEngineConfig = z.infer<typeof executionEngineConfigSchema>

// Main execution engine class
export class ExecutionEngine {
  private config: ExecutionEngineConfig
  private activeExecutions = new Map<string, ExecutionState>()
  private executionPromises = new Map<string, Promise<ExecutionState>>()
  private stepExecutors = new Map<string, StepExecutor>()
  private cleanupTimer: NodeJS.Timeout | null = null
  
  constructor(config: Partial<ExecutionEngineConfig> = {}) {
    this.config = executionEngineConfigSchema.parse(config)
    this.setupStepExecutors()
    this.startCleanupTimer()
    
    logger.info('Execution engine initialized', {
      category: 'system_startup',
      component: 'execution-engine',
      metadata: {
        maxConcurrentExecutions: this.config.limits.maxConcurrentExecutions,
        enableMetrics: this.config.monitoring.enableMetrics
      }
    })
  }
  
  // Execute a workflow
  async executeWorkflow(context: ExecutionContext): Promise<ExecutionState> {
    // Validate execution context
    const validatedContext = executionContextSchema.parse(context)
    
    // Check execution limits
    if (this.activeExecutions.size >= this.config.limits.maxConcurrentExecutions) {
      throw new Error('Maximum concurrent executions exceeded')
    }
    
    if (validatedContext.workflow.steps.length > this.config.limits.maxStepsPerExecution) {
      throw new Error('Maximum steps per execution exceeded')
    }
    
    // Initialize execution state
    const executionState: ExecutionState = {
      executionId: validatedContext.executionId,
      status: 'pending',
      progress: {
        currentStep: 0,
        totalSteps: validatedContext.workflow.steps.length,
        percentage: 0,
        completedSteps: [],
        failedSteps: [],
        activeSteps: []
      },
      timing: {
        startedAt: Date.now()
      },
      results: {
        stepResults: {},
        intermediateOutputs: []
      },
      errors: [],
      resources: {
        totalTokensUsed: 0,
        totalCostIncurred: 0,
        peakMemoryUsage: 0,
        agentUsage: {}
      },
      metadata: validatedContext.metadata
    }
    
    // Store execution state
    this.activeExecutions.set(validatedContext.executionId, executionState)
    
    // Start monitoring
    if (this.config.monitoring.enableMetrics) {
      startExecutionTracking(
        validatedContext.executionId,
        validatedContext.workflow.agents[0]?.agentId || 'system',
        validatedContext.projectId
      )
    }
    
    // Audit execution start
    if (this.config.monitoring.enableAuditLog) {
      auditSystem.auditExecutionEvent(
        validatedContext.workflow.agents[0]?.agentId || 'system',
        validatedContext.executionId,
        'execution_started',
        'success',
        {
          projectId: validatedContext.projectId,
          workflowPattern: validatedContext.workflow.pattern,
          totalSteps: validatedContext.workflow.steps.length
        }
      )
    }
    
    // Create execution promise
    const executionPromise = this.processWorkflow(validatedContext, executionState)
    this.executionPromises.set(validatedContext.executionId, executionPromise)
    
    logger.info('Workflow execution started', {
      category: 'execution',
      component: 'execution-engine',
      executionId: validatedContext.executionId,
      metadata: {
        projectId: validatedContext.projectId,
        pattern: validatedContext.workflow.pattern,
        stepCount: validatedContext.workflow.steps.length
      }
    })
    
    return executionPromise
  }
  
  // Get execution status
  getExecutionState(executionId: string): ExecutionState | null {
    return this.activeExecutions.get(executionId) || null
  }
  
  // Get all active executions
  getActiveExecutions(): ExecutionState[] {
    return Array.from(this.activeExecutions.values())
  }
  
  // Cancel execution
  async cancelExecution(executionId: string, reason?: string): Promise<boolean> {
    const state = this.activeExecutions.get(executionId)
    if (!state || state.status !== 'running') {
      return false
    }
    
    // Update state
    state.status = 'cancelled'
    state.timing.completedAt = Date.now()
    state.timing.duration = state.timing.completedAt - state.timing.startedAt
    
    // Audit cancellation
    if (this.config.monitoring.enableAuditLog) {
      auditSystem.auditExecutionEvent(
        'system',
        executionId,
        'execution_cancelled',
        'success',
        { reason }
      )
    }
    
    logger.info('Execution cancelled', {
      category: 'execution',
      component: 'execution-engine',
      executionId,
      metadata: { reason }
    })
    
    return true
  }
  
  // Private workflow processing methods
  private async processWorkflow(context: ExecutionContext, state: ExecutionState): Promise<ExecutionState> {
    try {
      state.status = 'running'
      
      // Execute workflow based on pattern
      switch (context.workflow.pattern) {
        case 'sequential':
          await this.executeSequential(context, state)
          break
        case 'parallel':
          await this.executeParallel(context, state)
          break
        case 'routing':
          await this.executeRouting(context, state)
          break
        case 'orchestrator-worker':
          await this.executeOrchestratorWorker(context, state)
          break
        case 'evaluator-optimizer':
          await this.executeEvaluatorOptimizer(context, state)
          break
        case 'multi-step-tool':
          await this.executeMultiStepTool(context, state)
          break
        default:
          throw new Error(`Unsupported workflow pattern: ${context.workflow.pattern}`)
      }
      
      // Mark as completed
      state.status = 'completed'
      state.progress.percentage = 1
      
    } catch (error) {
      // Handle execution error
      state.status = 'failed'
      const executionError = error as Error
      
      state.errors.push({
        stepId: 'execution',
        timestamp: Date.now(),
        error: {
          name: executionError.name,
          message: executionError.message,
          stack: executionError.stack,
          code: (executionError as any).code
        }
      })
      
      logger.error('Workflow execution failed', executionError, {
        category: 'execution',
        component: 'execution-engine',
        executionId: context.executionId
      })
    } finally {
      // Finalize execution
      this.finalizeExecution(context, state)
    }
    
    return state
  }
  
  private async executeSequential(context: ExecutionContext, state: ExecutionState): Promise<void> {
    let currentInput = context.input
    
    for (const step of context.workflow.steps) {
      if (state.status === 'cancelled') break
      
      state.progress.activeSteps = [step.id]
      
      try {
        const result = await this.executeStep(step, currentInput, context, state)
        
        if (result.status === 'completed') {
          state.progress.completedSteps.push(step.id)
          currentInput = result.output || currentInput
          state.results.stepResults[step.id] = result.output
        } else {
          state.progress.failedSteps.push(step.id)
          if (context.config.errorHandling === 'fail-fast') {
            throw new Error(`Step ${step.id} failed: ${result.error?.message}`)
          }
        }
        
        // Update progress
        state.progress.currentStep++
        state.progress.percentage = state.progress.currentStep / state.progress.totalSteps
        
      } catch (error) {
        state.progress.failedSteps.push(step.id)
        if (context.config.errorHandling === 'fail-fast') {
          throw error
        }
      } finally {
        state.progress.activeSteps = []
      }
    }
    
    state.results.finalResult = currentInput
  }
  
  private async executeParallel(context: ExecutionContext, state: ExecutionState): Promise<void> {
    const stepPromises = context.workflow.steps.map(step => 
      this.executeStep(step, context.input, context, state)
    )
    
    state.progress.activeSteps = context.workflow.steps.map(s => s.id)
    
    const results = await Promise.allSettled(stepPromises)
    
    results.forEach((result, index) => {
      const step = context.workflow.steps[index]
      
      if (result.status === 'fulfilled' && result.value.status === 'completed') {
        state.progress.completedSteps.push(step.id)
        state.results.stepResults[step.id] = result.value.output
      } else {
        state.progress.failedSteps.push(step.id)
        if (context.config.errorHandling === 'fail-fast' && result.status === 'rejected') {
          throw result.reason
        }
      }
    })
    
    state.progress.activeSteps = []
    state.progress.currentStep = state.progress.totalSteps
    state.progress.percentage = 1
    
    // Combine results
    state.results.finalResult = Object.fromEntries(
      Object.entries(state.results.stepResults)
    )
  }
  
  private async executeRouting(context: ExecutionContext, state: ExecutionState): Promise<void> {
    let currentInput = context.input
    
    for (const step of context.workflow.steps) {
      if (state.status === 'cancelled') break
      
      // Evaluate routing condition
      if (step.condition && !this.evaluateCondition(step.condition, currentInput)) {
        continue
      }
      
      state.progress.activeSteps = [step.id]
      
      try {
        const result = await this.executeStep(step, currentInput, context, state)
        
        if (result.status === 'completed') {
          state.progress.completedSteps.push(step.id)
          currentInput = result.output || currentInput
          state.results.stepResults[step.id] = result.output
          
          // For routing, we might stop after first successful match
          if ((step as any).metadata?.breakOnSuccess) {
            break
          }
        } else {
          state.progress.failedSteps.push(step.id)
        }
        
        state.progress.currentStep++
        state.progress.percentage = Math.min(1, state.progress.currentStep / state.progress.totalSteps)
        
      } catch (error) {
        state.progress.failedSteps.push(step.id)
        if (context.config.errorHandling === 'fail-fast') {
          throw error
        }
      } finally {
        state.progress.activeSteps = []
      }
    }
    
    state.results.finalResult = currentInput
  }
  
  private async executeOrchestratorWorker(context: ExecutionContext, state: ExecutionState): Promise<void> {
    // Find orchestrator and workers
    const orchestratorStep = context.workflow.steps.find(s => 
      context.workflow.agents.find(a => a.agentId === s.agentId)?.role === 'director'
    )
    
    const workerSteps = context.workflow.steps.filter(s => s.id !== orchestratorStep?.id)
    
    if (!orchestratorStep) {
      throw new Error('Orchestrator-Worker pattern requires a director agent')
    }
    
    // Execute orchestrator first to get work distribution
    state.progress.activeSteps = [orchestratorStep.id]
    const orchestratorResult = await this.executeStep(orchestratorStep, context.input, context, state)
    
    if (orchestratorResult.status !== 'completed') {
      throw new Error('Orchestrator step failed')
    }
    
    state.progress.completedSteps.push(orchestratorStep.id)
    state.results.stepResults[orchestratorStep.id] = orchestratorResult.output
    
    // Execute workers in parallel with orchestrator output
    const workerInput = orchestratorResult.output || context.input
    const workerPromises = workerSteps.map(step => 
      this.executeStep(step, workerInput, context, state)
    )
    
    state.progress.activeSteps = workerSteps.map(s => s.id)
    
    const workerResults = await Promise.allSettled(workerPromises)
    
    // Process worker results
    const successfulResults: any[] = []
    workerResults.forEach((result, index) => {
      const step = workerSteps[index]
      
      if (result.status === 'fulfilled' && result.value.status === 'completed') {
        state.progress.completedSteps.push(step.id)
        state.results.stepResults[step.id] = result.value.output
        successfulResults.push(result.value.output)
      } else {
        state.progress.failedSteps.push(step.id)
      }
    })
    
    state.progress.activeSteps = []
    state.progress.currentStep = state.progress.totalSteps
    state.progress.percentage = 1
    
    // Combine orchestrator and worker results
    state.results.finalResult = {
      orchestrator: orchestratorResult.output,
      workers: successfulResults
    }
  }
  
  private async executeEvaluatorOptimizer(context: ExecutionContext, state: ExecutionState): Promise<void> {
    // This pattern involves iterative execution with evaluation and optimization
    let currentInput = context.input
    let iteration = 0
    const maxIterations = 5 // Configurable
    
    while (iteration < maxIterations && state.status !== 'cancelled') {
      // Execute all steps in current iteration
      for (const step of context.workflow.steps) {
        state.progress.activeSteps = [step.id]
        
        try {
          const result = await this.executeStep(step, currentInput, context, state)
          
          if (result.status === 'completed') {
            state.results.stepResults[`${step.id}_${iteration}`] = result.output
            currentInput = result.output || currentInput
          }
          
        } finally {
          state.progress.activeSteps = []
        }
      }
      
      // Evaluate if optimization is needed (simplified)
      const shouldContinue = await this.shouldContinueOptimization(currentInput, iteration)
      if (!shouldContinue) break
      
      iteration++
    }
    
    state.results.finalResult = currentInput
    state.progress.currentStep = state.progress.totalSteps
    state.progress.percentage = 1
  }
  
  private async executeMultiStepTool(context: ExecutionContext, state: ExecutionState): Promise<void> {
    // This pattern involves complex tool coordination
    let toolContext = context.input
    
    for (const step of context.workflow.steps) {
      if (state.status === 'cancelled') break
      
      state.progress.activeSteps = [step.id]
      
      try {
        // Multi-step tool execution with tool state management
        const result = await this.executeStep(step, toolContext, context, state)
        
        if (result.status === 'completed') {
          state.progress.completedSteps.push(step.id)
          state.results.stepResults[step.id] = result.output
          
          // Update tool context for next step
          toolContext = {
            ...toolContext,
            [`step_${step.id}_output`]: result.output,
            previousStep: step.id
          }
        } else {
          state.progress.failedSteps.push(step.id)
          if (context.config.errorHandling === 'fail-fast') {
            throw new Error(`Tool step ${step.id} failed`)
          }
        }
        
        state.progress.currentStep++
        state.progress.percentage = state.progress.currentStep / state.progress.totalSteps
        
      } finally {
        state.progress.activeSteps = []
      }
    }
    
    state.results.finalResult = toolContext
  }
  
  // Step execution
  private async executeStep(
    step: ExecutionContext['workflow']['steps'][0],
    input: any,
    context: ExecutionContext,
    state: ExecutionState
  ): Promise<StepResult> {
    
    const stepResult: StepResult = {
      stepId: step.id,
      agentId: step.agentId,
      status: 'running',
      execution: {
        startedAt: Date.now(),
        retryAttempt: 0
      },
      input,
      performance: {
        tokensUsed: 0,
        cost: 0,
        modelCalls: 0
      },
      metadata: {}
    }
    
    try {
      // Get step executor
      const executor = this.stepExecutors.get(step.agentId)
      if (!executor) {
        throw new Error(`No executor found for agent ${step.agentId}`)
      }
      
      // Execute step with retry logic
      const maxAttempts = step.retry?.maxAttempts || this.config.retryConfig.defaultMaxAttempts
      let lastError: Error | null = null
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        stepResult.execution.retryAttempt = attempt
        
        try {
          const result = await this.executeWithTimeout(
            () => executor.execute(step, input, context),
            context.config.timeout
          )
          
          stepResult.status = 'completed'
          stepResult.output = result.output
          stepResult.performance = result.performance || stepResult.performance
          stepResult.execution.completedAt = Date.now()
          stepResult.execution.duration = stepResult.execution.completedAt - stepResult.execution.startedAt
          
          // Update resource usage
          this.updateResourceUsage(state, stepResult)
          
          break // Success, exit retry loop
          
        } catch (error) {
          lastError = error as Error
          
          if (attempt < maxAttempts - 1) {
            // Calculate backoff delay
            const backoffMs = this.calculateBackoff(attempt, step.retry?.backoffMs)
            await new Promise(resolve => setTimeout(resolve, backoffMs))
          }
        }
      }
      
      if (stepResult.status !== 'completed' && lastError) {
        stepResult.status = 'failed'
        stepResult.error = {
          name: lastError.name,
          message: lastError.message,
          stack: lastError.stack,
          recoverable: this.isRecoverableError(lastError)
        }
      }
      
    } catch (error) {
      stepResult.status = 'failed'
      stepResult.error = {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack,
        recoverable: false
      }
    }
    
    // Log step completion
    const logLevel = stepResult.status === 'completed' ? 'info' : 'error'
    if (logLevel === 'error' && stepResult.error) {
      const error = new Error(stepResult.error.message)
      error.name = stepResult.error.name
      agentLogger.error(`Step ${stepResult.status}: ${step.name}`, error, {
        executionId: context.executionId,
        agentId: step.agentId,
        metadata: {
          stepId: step.id,
          duration: stepResult.execution.duration,
          tokensUsed: stepResult.performance.tokensUsed,
          cost: stepResult.performance.cost
        }
      })
    } else {
      agentLogger.info(`Step ${stepResult.status}: ${step.name}`, {
        executionId: context.executionId,
        agentId: step.agentId,
        metadata: {
          stepId: step.id,
          duration: stepResult.execution.duration,
          tokensUsed: stepResult.performance.tokensUsed,
          cost: stepResult.performance.cost
        }
      })
    }
    
    return stepResult
  }
  
  // Helper methods
  private setupStepExecutors(): void {
    // In a real implementation, these would be loaded dynamically
    this.stepExecutors.set('mock-agent', new MockStepExecutor())
  }
  
  private evaluateCondition(condition: string, input: any): boolean {
    // Simple condition evaluation - would be more sophisticated in production
    try {
      const func = new Function('input', `return ${condition}`)
      return func(input)
    } catch {
      return false
    }
  }
  
  private async shouldContinueOptimization(result: any, iteration: number): Promise<boolean> {
    // Simple optimization check - would use ML/heuristics in production
    return iteration < 3 && (!result.optimized || result.score < 0.8)
  }
  
  private calculateBackoff(attempt: number, baseMs?: number): number {
    const base = baseMs || this.config.retryConfig.defaultBackoffMs
    if (this.config.retryConfig.exponentialBackoff) {
      return Math.min(base * Math.pow(2, attempt), this.config.retryConfig.maxBackoffMs)
    }
    return base
  }
  
  private isRecoverableError(error: Error): boolean {
    // Determine if error is recoverable
    const unrecoverableErrors = ['ENOTFOUND', 'ECONNREFUSED', 'AUTH_ERROR']
    return !unrecoverableErrors.includes((error as any).code)
  }
  
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Execution timeout')), timeoutMs)
      )
    ])
  }
  
  private updateResourceUsage(state: ExecutionState, stepResult: StepResult): void {
    state.resources.totalTokensUsed += stepResult.performance.tokensUsed
    state.resources.totalCostIncurred += stepResult.performance.cost
    
    if (!state.resources.agentUsage[stepResult.agentId]) {
      state.resources.agentUsage[stepResult.agentId] = {
        tokens: 0,
        cost: 0,
        executionTime: 0
      }
    }
    
    const agentUsage = state.resources.agentUsage[stepResult.agentId]
    agentUsage.tokens += stepResult.performance.tokensUsed
    agentUsage.cost += stepResult.performance.cost
    agentUsage.executionTime += stepResult.execution.duration || 0
  }
  
  private finalizeExecution(context: ExecutionContext, state: ExecutionState): void {
    // Complete timing
    state.timing.completedAt = Date.now()
    state.timing.duration = state.timing.completedAt - state.timing.startedAt
    
    // Audit completion
    if (this.config.monitoring.enableAuditLog) {
      const eventType = state.status === 'completed' ? 'execution_completed' : 'execution_failed'
      auditSystem.auditExecutionEvent(
        context.workflow.agents[0]?.agentId || 'system',
        context.executionId,
        eventType,
        state.status === 'completed' ? 'success' : 'failure',
        {
          duration: state.timing.duration,
          totalSteps: state.progress.totalSteps,
          completedSteps: state.progress.completedSteps.length,
          failedSteps: state.progress.failedSteps.length,
          totalTokens: state.resources.totalTokensUsed,
          totalCost: state.resources.totalCostIncurred
        }
      )
    }
    
    // Clean up
    this.executionPromises.delete(context.executionId)
    
    logger.info('Workflow execution finalized', {
      category: 'execution',
      component: 'execution-engine',
      executionId: context.executionId,
      metadata: {
        status: state.status,
        duration: state.timing.duration,
        totalCost: state.resources.totalCostIncurred,
        completedSteps: state.progress.completedSteps.length
      },
      performance: {
        duration: state.timing.duration,
        tokenCount: state.resources.totalTokensUsed,
        cost: state.resources.totalCostIncurred
      }
    })
  }
  
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupCompletedExecutions()
    }, 300000) // 5 minutes
  }
  
  private cleanupCompletedExecutions(): void {
    const now = Date.now()
    const cleanupThreshold = 3600000 // 1 hour
    
    for (const [executionId, state] of this.activeExecutions) {
      if (state.timing.completedAt && (now - state.timing.completedAt) > cleanupThreshold) {
        this.activeExecutions.delete(executionId)
        this.executionPromises.delete(executionId)
      }
    }
  }
  
  async close(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    
    // Cancel all active executions
    for (const executionId of this.activeExecutions.keys()) {
      await this.cancelExecution(executionId, 'System shutdown')
    }
    
    logger.info('Execution engine closed', {
      category: 'system_shutdown',
      component: 'execution-engine'
    })
  }
}

// Step executor interface
export interface StepExecutor {
  execute(
    step: ExecutionContext['workflow']['steps'][0], 
    input: any, 
    context: ExecutionContext
  ): Promise<{
    output: any
    performance?: {
      tokensUsed: number
      cost: number
      modelCalls: number
      memoryUsage?: number
    }
  }>
}

// Mock step executor for testing
class MockStepExecutor implements StepExecutor {
  async execute(step: ExecutionContext['workflow']['steps'][0], input: any): Promise<{
    output: any
    performance: {
      tokensUsed: number
      cost: number
      modelCalls: number
    }
  }> {
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500))
    
    // Mock output generation
    const output = {
      stepId: step.id,
      processedInput: input,
      result: `Processed by agent ${step.agentId}`,
      timestamp: Date.now()
    }
    
    // Mock performance metrics
    const performance = {
      tokensUsed: Math.floor(Math.random() * 1000) + 100,
      cost: Math.random() * 0.01,
      modelCalls: 1
    }
    
    return { output, performance }
  }
}

// Global execution engine instance
export const executionEngine = new ExecutionEngine()

// Utility functions
export const executeWorkflow = async (context: ExecutionContext): Promise<ExecutionState> => {
  return executionEngine.executeWorkflow(context)
}

export const getExecutionStatus = (executionId: string): ExecutionState | null => {
  return executionEngine.getExecutionState(executionId)
}

export const cancelWorkflowExecution = async (executionId: string, reason?: string): Promise<boolean> => {
  return executionEngine.cancelExecution(executionId, reason)
}