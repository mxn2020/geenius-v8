// src/lib/background-job-processor.ts - Background Job Processing for Long-Running Agent Operations

import { z } from 'zod'
import { logger } from './logging-system'
import { performanceCollector } from './performance-metrics'
import { auditSystem } from './audit-system'
import { realtimeMonitor } from './realtime-monitoring'
import { executionEngine, ExecutionContext, ExecutionState } from './execution-engine'

// Job definition schemas
export const jobSchema = z.object({
  id: z.string(),
  type: z.enum([
    'workflow_execution',
    'agent_training',
    'data_processing',
    'model_optimization',
    'batch_execution',
    'scheduled_task',
    'cleanup_task',
    'analytics_computation'
  ]),
  status: z.enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'retrying']),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  
  // Job data
  payload: z.record(z.string(), z.any()),
  
  // Scheduling
  scheduling: z.object({
    scheduledAt: z.number(),
    startAfter: z.number().optional(),
    deadline: z.number().optional(),
    recurring: z.object({
      enabled: z.boolean().default(false),
      pattern: z.string().optional(), // cron-like pattern
      nextRun: z.number().optional()
    }).default({ enabled: false })
  }),
  
  // Execution configuration
  config: z.object({
    timeout: z.number().default(3600000), // 1 hour
    maxRetries: z.number().default(3),
    retryDelay: z.number().default(5000),
    concurrency: z.number().default(1),
    resourceLimits: z.object({
      maxMemory: z.number().optional(),
      maxCpu: z.number().optional(),
      maxDuration: z.number().optional()
    }).optional()
  }).default({
    timeout: 3600000,
    maxRetries: 3,
    retryDelay: 5000,
    concurrency: 1
  }),
  
  // Dependencies
  dependencies: z.array(z.string()).default([]),
  dependents: z.array(z.string()).default([]),
  
  // Progress tracking
  progress: z.object({
    percentage: z.number().min(0).max(100).default(0),
    currentPhase: z.string().optional(),
    estimatedCompletion: z.number().optional(),
    lastUpdate: z.number().optional()
  }).default({ percentage: 0 }),
  
  // Results and errors
  result: z.any().optional(),
  error: z.object({
    name: z.string(),
    message: z.string(),
    stack: z.string().optional(),
    code: z.string().optional(),
    retryable: z.boolean().default(true)
  }).optional(),
  
  // Metadata
  metadata: z.object({
    projectId: z.string().optional(),
    userId: z.string().optional(),
    agentId: z.string().optional(),
    executionId: z.string().optional(),
    tags: z.array(z.string()).default([]),
    parentJobId: z.string().optional(),
    childJobIds: z.array(z.string()).default([])
  }).default({ tags: [], childJobIds: [] }),
  
  // Timestamps
  timestamps: z.object({
    createdAt: z.number(),
    startedAt: z.number().optional(),
    completedAt: z.number().optional(),
    lastRetryAt: z.number().optional(),
    nextRetryAt: z.number().optional()
  }),
  
  // Execution history
  history: z.array(z.object({
    timestamp: z.number(),
    event: z.enum(['created', 'started', 'progress', 'completed', 'failed', 'cancelled', 'retrying']),
    data: z.record(z.string(), z.any()).optional()
  })).default([])
})

export type Job = z.infer<typeof jobSchema>

// Job processor configuration
export const jobProcessorConfigSchema = z.object({
  // Worker configuration
  workers: z.object({
    maxConcurrentJobs: z.number().default(5),
    maxJobsPerWorker: z.number().default(10),
    workerIdleTimeout: z.number().default(300000), // 5 minutes
    enableWorkerScaling: z.boolean().default(true)
  }).default({
    maxConcurrentJobs: 5,
    maxJobsPerWorker: 10,
    workerIdleTimeout: 300000,
    enableWorkerScaling: true
  }),
  
  // Queue configuration
  queue: z.object({
    maxQueueSize: z.number().default(1000),
    priorityLevels: z.number().default(4),
    batchSize: z.number().default(10),
    pollingInterval: z.number().default(1000),
    deadLetterEnabled: z.boolean().default(true)
  }).default({
    maxQueueSize: 1000,
    priorityLevels: 4,
    batchSize: 10,
    pollingInterval: 1000,
    deadLetterEnabled: true
  }),
  
  // Retry configuration
  retry: z.object({
    exponentialBackoff: z.boolean().default(true),
    backoffMultiplier: z.number().default(2),
    maxBackoffDelay: z.number().default(300000), // 5 minutes
    jitter: z.boolean().default(true)
  }).default({
    exponentialBackoff: true,
    backoffMultiplier: 2,
    maxBackoffDelay: 300000,
    jitter: true
  }),
  
  // Monitoring
  monitoring: z.object({
    enableMetrics: z.boolean().default(true),
    enableHealthChecks: z.boolean().default(true),
    healthCheckInterval: z.number().default(30000),
    alertThresholds: z.object({
      queueDepth: z.number().default(100),
      failureRate: z.number().default(0.1),
      avgProcessingTime: z.number().default(60000)
    }).default({
      queueDepth: 100,
      failureRate: 0.1,
      avgProcessingTime: 60000
    })
  }).default({
    enableMetrics: true,
    enableHealthChecks: true,
    healthCheckInterval: 30000,
    alertThresholds: {
      queueDepth: 100,
      failureRate: 0.1,
      avgProcessingTime: 60000
    }
  }),
  
  // Persistence
  persistence: z.object({
    enableJobPersistence: z.boolean().default(true),
    saveInterval: z.number().default(10000),
    retentionDays: z.number().default(30),
    compressionEnabled: z.boolean().default(true)
  }).default({
    enableJobPersistence: true,
    saveInterval: 10000,
    retentionDays: 30,
    compressionEnabled: true
  })
})

export type JobProcessorConfig = z.infer<typeof jobProcessorConfigSchema>

// Job processor interface
export interface JobProcessor {
  process(job: Job): Promise<JobResult>
}

export interface JobResult {
  success: boolean
  result?: any
  error?: {
    name: string
    message: string
    stack?: string
    retryable: boolean
  }
  progress?: {
    percentage: number
    currentPhase?: string
    estimatedCompletion?: number
  }
  metadata?: Record<string, any>
}

// Background job processor class
export class BackgroundJobProcessor {
  private config: JobProcessorConfig
  private jobQueue = new Map<string, Job>()
  private runningJobs = new Map<string, Job>()
  private completedJobs = new Map<string, Job>()
  private failedJobs = new Map<string, Job>()
  private processors = new Map<Job['type'], JobProcessor>()
  private workers: Worker[] = []
  private isRunning = false
  private pollingTimer: NodeJS.Timeout | null = null
  private healthCheckTimer: NodeJS.Timeout | null = null
  private persistenceTimer: NodeJS.Timeout | null = null
  
  constructor(config: Partial<JobProcessorConfig> = {}) {
    this.config = jobProcessorConfigSchema.parse(config)
    this.setupProcessors()
    
    logger.info('Background job processor initialized', {
      category: 'system_startup',
      component: 'background-job-processor',
      metadata: {
        maxConcurrentJobs: this.config.workers.maxConcurrentJobs,
        enableMetrics: this.config.monitoring.enableMetrics
      }
    })
  }
  
  // Job management
  async addJob(jobData: Omit<Job, 'id' | 'timestamps' | 'history'>): Promise<string> {
    const job: Job = {
      id: this.generateJobId(),
      ...jobData,
      timestamps: {
        createdAt: Date.now()
      },
      history: [{
        timestamp: Date.now(),
        event: 'created',
        data: { type: jobData.type, priority: jobData.priority }
      }]
    }
    
    // Validate job
    const validatedJob = jobSchema.parse(job)
    
    // Check queue capacity
    if (this.jobQueue.size >= this.config.queue.maxQueueSize) {
      throw new Error('Job queue is at capacity')
    }
    
    // Add to queue
    this.jobQueue.set(job.id, validatedJob)
    
    // Audit job creation
    auditSystem.audit(
      'job_created',
      {
        type: 'agent',
        id: jobData.metadata.agentId || 'system'
      },
      {
        description: `Job created: ${job.type}`,
        action: 'create',
        outcome: 'success'
      },
      {
        category: 'system',
        severity: 'low',
        metadata: {
          jobId: job.id,
          executionId: jobData.metadata.executionId,
          jobType: job.type,
          priority: job.priority,
          scheduledAt: job.scheduling.scheduledAt
        }
      }
    )
    
    logger.info('Job added to queue', {
      category: 'job_management',
      component: 'background-job-processor',
      metadata: {
        jobId: job.id,
        type: job.type,
        priority: job.priority,
        queueSize: this.jobQueue.size
      }
    })
    
    return job.id
  }
  
  async getJob(jobId: string): Promise<Job | null> {
    return this.jobQueue.get(jobId) || 
           this.runningJobs.get(jobId) || 
           this.completedJobs.get(jobId) || 
           this.failedJobs.get(jobId) || 
           null
  }
  
  async getJobsByStatus(status: Job['status']): Promise<Job[]> {
    const jobs: Job[] = []
    
    const collections = [
      this.jobQueue,
      this.runningJobs,
      this.completedJobs,
      this.failedJobs
    ]
    
    for (const collection of collections) {
      for (const job of collection.values()) {
        if (job.status === status) {
          jobs.push(job)
        }
      }
    }
    
    return jobs
  }
  
  async cancelJob(jobId: string, reason?: string): Promise<boolean> {
    const job = await this.getJob(jobId)
    if (!job) return false
    
    if (job.status === 'running') {
      // Cancel running job
      job.status = 'cancelled'
      job.timestamps.completedAt = Date.now()
      job.history.push({
        timestamp: Date.now(),
        event: 'cancelled',
        data: { reason }
      })
      
      // Move from running to failed
      this.runningJobs.delete(jobId)
      this.failedJobs.set(jobId, job)
    } else if (job.status === 'pending') {
      // Cancel queued job
      job.status = 'cancelled'
      job.timestamps.completedAt = Date.now()
      job.history.push({
        timestamp: Date.now(),
        event: 'cancelled',
        data: { reason }
      })
      
      // Move from queue to failed
      this.jobQueue.delete(jobId)
      this.failedJobs.set(jobId, job)
    }
    
    logger.info('Job cancelled', {
      category: 'job_management',
      component: 'background-job-processor',
      metadata: { jobId, reason }
    })
    
    return true
  }
  
  // Job processing
  async start(): Promise<void> {
    if (this.isRunning) return
    
    this.isRunning = true
    this.startPolling()
    this.startHealthChecks()
    this.startPersistence()
    
    logger.info('Background job processor started', {
      category: 'system_startup',
      component: 'background-job-processor'
    })
  }
  
  async stop(): Promise<void> {
    if (!this.isRunning) return
    
    this.isRunning = false
    
    // Stop timers
    if (this.pollingTimer) clearInterval(this.pollingTimer)
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer)
    if (this.persistenceTimer) clearInterval(this.persistenceTimer)
    
    // Cancel all running jobs
    for (const jobId of this.runningJobs.keys()) {
      await this.cancelJob(jobId, 'System shutdown')
    }
    
    logger.info('Background job processor stopped', {
      category: 'system_shutdown',
      component: 'background-job-processor'
    })
  }
  
  private startPolling(): void {
    this.pollingTimer = setInterval(async () => {
      try {
        await this.processNextJobs()
      } catch (error) {
        logger.error('Error in job polling', error as Error, {
          category: 'job_processing',
          component: 'background-job-processor'
        })
      }
    }, this.config.queue.pollingInterval)
  }
  
  private async processNextJobs(): Promise<void> {
    if (this.runningJobs.size >= this.config.workers.maxConcurrentJobs) {
      return // At capacity
    }
    
    // Get next batch of jobs to process
    const jobsToProcess = this.getNextJobsToProcess()
    
    for (const job of jobsToProcess) {
      if (this.runningJobs.size >= this.config.workers.maxConcurrentJobs) {
        break
      }
      
      await this.startJobExecution(job)
    }
  }
  
  private getNextJobsToProcess(): Job[] {
    const availableSlots = this.config.workers.maxConcurrentJobs - this.runningJobs.size
    const batchSize = Math.min(this.config.queue.batchSize, availableSlots)
    
    if (batchSize <= 0) return []
    
    const now = Date.now()
    const readyJobs = Array.from(this.jobQueue.values())
      .filter(job => 
        job.status === 'pending' && 
        (!job.scheduling.startAfter || job.scheduling.startAfter <= now) &&
        this.areDependenciesMet(job)
      )
      .sort(this.compareJobPriority)
      .slice(0, batchSize)
    
    return readyJobs
  }
  
  private areDependenciesMet(job: Job): boolean {
    return job.dependencies.every(depId => {
      const depJob = this.completedJobs.get(depId)
      return depJob && depJob.status === 'completed'
    })
  }
  
  private compareJobPriority(a: Job, b: Job): number {
    const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 }
    const aPriority = priorityOrder[a.priority]
    const bPriority = priorityOrder[b.priority]
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority // Higher priority first
    }
    
    // Same priority, use scheduled time
    return a.scheduling.scheduledAt - b.scheduling.scheduledAt
  }
  
  private async startJobExecution(job: Job): Promise<void> {
    // Move job to running state
    job.status = 'running'
    job.timestamps.startedAt = Date.now()
    job.history.push({
      timestamp: Date.now(),
      event: 'started'
    })
    
    this.jobQueue.delete(job.id)
    this.runningJobs.set(job.id, job)
    
    logger.info('Job execution started', {
      category: 'job_processing',
      component: 'background-job-processor',
      metadata: {
        jobId: job.id,
        type: job.type,
        priority: job.priority
      }
    })
    
    // Execute job asynchronously
    this.executeJob(job).catch((error: Error) => {
      logger.error('Unhandled job execution error', error as Error, {
        category: 'job_processing',
        component: 'background-job-processor',
        metadata: { jobId: job.id }
      })
    })
  }
  
  private async executeJob(job: Job): Promise<void> {
    const processor = this.processors.get(job.type)
    if (!processor) {
      await this.failJob(job, new Error(`No processor found for job type: ${job.type}`))
      return
    }
    
    const executionTracker = performanceCollector.startExecution(
      job.id,
      job.metadata.agentId || 'background-job',
      job.metadata.projectId || 'system'
    )
    
    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(
        () => processor.process(job),
        job.config.timeout
      )
      
      if (result.success) {
        await this.completeJob(job, result.result, result.metadata)
      } else if (result.error) {
        const error = new Error(result.error.message)
        error.name = result.error.name
        ;(error as any).retryable = result.error.retryable
        
        await this.failJob(job, error)
      }
      
    } catch (error) {
      await this.failJob(job, error as Error)
    } finally {
      executionTracker.complete(job.result || {}, (job as any).performance || {})
    }
  }
  
  private async completeJob(job: Job, result?: any, metadata?: Record<string, any>): Promise<void> {
    job.status = 'completed'
    job.result = result
    job.progress.percentage = 100
    job.timestamps.completedAt = Date.now()
    job.history.push({
      timestamp: Date.now(),
      event: 'completed',
      data: { hasResult: !!result }
    })
    
    if (metadata) {
      job.metadata = { ...job.metadata, ...metadata }
    }
    
    // Move from running to completed
    this.runningJobs.delete(job.id)
    this.completedJobs.set(job.id, job)
    
    // Process dependent jobs
    await this.processDependentJobs(job.id)
    
    // Handle recurring jobs
    if (job.scheduling.recurring.enabled) {
      await this.scheduleRecurringJob(job)
    }
    
    // Audit completion
    auditSystem.audit(
      'job_completed',
      {
        type: 'agent',
        id: job.metadata.agentId || 'system'
      },
      {
        description: `Job completed: ${job.type}`,
        action: 'complete',
        outcome: 'success'
      },
      {
        category: 'system',
        severity: 'low',
        metadata: {
          jobId: job.id,
          executionId: job.metadata.executionId,
          jobType: job.type,
          duration: job.timestamps.completedAt - (job.timestamps.startedAt || job.timestamps.createdAt)
        }
      }
    )
    
    logger.info('Job completed successfully', {
      category: 'job_processing',
      component: 'background-job-processor',
      metadata: {
        jobId: job.id,
        type: job.type,
        duration: job.timestamps.completedAt - (job.timestamps.startedAt || job.timestamps.createdAt)
      }
    })
  }
  
  private async failJob(job: Job, error: Error): Promise<void> {
    const retryCount = job.history.filter(h => h.event === 'retrying').length
    const canRetry = retryCount < job.config.maxRetries && this.isRetryableError(error)
    
    if (canRetry) {
      // Schedule retry
      job.status = 'retrying'
      job.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        retryable: true
      }
      
      const retryDelay = this.calculateRetryDelay(retryCount, job.config.retryDelay)
      job.timestamps.nextRetryAt = Date.now() + retryDelay
      job.timestamps.lastRetryAt = Date.now()
      
      job.history.push({
        timestamp: Date.now(),
        event: 'retrying',
        data: {
          attempt: retryCount + 1,
          nextRetryAt: job.timestamps.nextRetryAt,
          error: error.message
        }
      })
      
      // Move back to queue for retry
      this.runningJobs.delete(job.id)
      
      setTimeout(() => {
        job.status = 'pending'
        this.jobQueue.set(job.id, job)
      }, retryDelay)
      
      logger.warn('Job scheduled for retry', {
        category: 'job_processing',
        component: 'background-job-processor',
        metadata: {
          jobId: job.id,
          retryAttempt: retryCount + 1,
          retryDelay,
          error: error.message
        }
      })
      
    } else {
      // Permanent failure
      job.status = 'failed'
      job.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
        retryable: false
      }
      job.timestamps.completedAt = Date.now()
      job.history.push({
        timestamp: Date.now(),
        event: 'failed',
        data: { error: error.message, retriesExhausted: retryCount >= job.config.maxRetries }
      })
      
      // Move from running to failed
      this.runningJobs.delete(job.id)
      this.failedJobs.set(job.id, job)
      
      // Audit failure
      auditSystem.audit(
        'job_failed',
        {
          type: 'agent',
          id: job.metadata.agentId || 'system'
        },
        {
          description: `Job failed: ${job.type}`,
          action: 'execute',
          outcome: 'failure',
          reason: error.message
        },
        {
          category: 'system',
          severity: 'high',
          metadata: {
            jobId: job.id,
            executionId: job.metadata.executionId,
            jobType: job.type,
            error: error.message,
            retryCount
          }
        }
      )
      
      logger.error('Job failed permanently', error, {
        category: 'job_processing',
        component: 'background-job-processor',
        metadata: {
          jobId: job.id,
          type: job.type,
          retryCount
        }
      })
    }
  }
  
  // Utility methods
  private setupProcessors(): void {
    // Setup built-in processors
    this.processors.set('workflow_execution', new WorkflowExecutionProcessor())
    this.processors.set('batch_execution', new BatchExecutionProcessor())
    this.processors.set('cleanup_task', new CleanupTaskProcessor())
    this.processors.set('analytics_computation', new AnalyticsComputationProcessor())
  }
  
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2)}`
  }
  
  private isRetryableError(error: Error): boolean {
    const nonRetryableErrors = ['ValidationError', 'AuthorizationError', 'NotFoundError']
    return !nonRetryableErrors.includes(error.name) && (error as any).retryable !== false
  }
  
  private calculateRetryDelay(attempt: number, baseDelay: number): number {
    if (!this.config.retry.exponentialBackoff) {
      return baseDelay
    }
    
    let delay = baseDelay * Math.pow(this.config.retry.backoffMultiplier, attempt)
    delay = Math.min(delay, this.config.retry.maxBackoffDelay)
    
    if (this.config.retry.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5) // Add 0-50% jitter
    }
    
    return Math.floor(delay)
  }
  
  private async executeWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => 
        setTimeout(() => reject(new Error('Job execution timeout')), timeoutMs)
      )
    ])
  }
  
  private async processDependentJobs(completedJobId: string): Promise<void> {
    // Find jobs that depend on the completed job
    const dependentJobs = Array.from(this.jobQueue.values())
      .filter(job => job.dependencies.includes(completedJobId))
    
    // Check if their dependencies are now met and process them
    for (const job of dependentJobs) {
      if (this.areDependenciesMet(job)) {
        // Dependencies are met, job can be processed in next cycle
        logger.info('Job dependencies met', {
          category: 'job_processing',
          component: 'background-job-processor',
          metadata: {
            jobId: job.id,
            completedDependency: completedJobId
          }
        })
      }
    }
  }
  
  private async scheduleRecurringJob(completedJob: Job): Promise<void> {
    if (!completedJob.scheduling.recurring.enabled || !completedJob.scheduling.recurring.pattern) {
      return
    }
    
    // Calculate next run time based on pattern
    const nextRunTime = this.calculateNextRunTime(completedJob.scheduling.recurring.pattern)
    
    // Create new job for next occurrence
    const newJobData: Omit<Job, 'id' | 'timestamps' | 'history'> = {
      ...completedJob,
      status: 'pending',
      scheduling: {
        ...completedJob.scheduling,
        scheduledAt: nextRunTime,
        recurring: {
          ...completedJob.scheduling.recurring,
          nextRun: nextRunTime
        }
      },
      progress: { percentage: 0 },
      result: undefined,
      error: undefined,
      metadata: {
        ...completedJob.metadata,
        parentJobId: completedJob.id
      }
    }
    
    await this.addJob(newJobData)
  }
  
  private calculateNextRunTime(cronPattern: string): number {
    // Simplified cron parsing - would use a proper cron library in production
    const now = new Date()
    
    // Basic patterns
    if (cronPattern === '@hourly') {
      return now.getTime() + 3600000
    } else if (cronPattern === '@daily') {
      return now.getTime() + 86400000
    } else if (cronPattern === '@weekly') {
      return now.getTime() + 604800000
    } else {
      // Default to hourly
      return now.getTime() + 3600000
    }
  }
  
  // Health checks and monitoring
  private startHealthChecks(): void {
    if (!this.config.monitoring.enableHealthChecks) return
    
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck()
    }, this.config.monitoring.healthCheckInterval)
  }
  
  private performHealthCheck(): void {
    const stats = this.getProcessorStats()
    
    // Check queue depth
    if (stats.queueDepth > this.config.monitoring.alertThresholds.queueDepth) {
      logger.warn('High queue depth detected', {
        category: 'health_check',
        component: 'background-job-processor',
        metadata: {
          currentDepth: stats.queueDepth,
          threshold: this.config.monitoring.alertThresholds.queueDepth
        }
      })
    }
    
    // Check failure rate
    if (stats.failureRate > this.config.monitoring.alertThresholds.failureRate) {
      logger.warn('High failure rate detected', {
        category: 'health_check',
        component: 'background-job-processor',
        metadata: {
          currentRate: stats.failureRate,
          threshold: this.config.monitoring.alertThresholds.failureRate
        }
      })
    }
    
    // Check average processing time
    if (stats.avgProcessingTime > this.config.monitoring.alertThresholds.avgProcessingTime) {
      logger.warn('High average processing time detected', {
        category: 'health_check',
        component: 'background-job-processor',
        metadata: {
          currentTime: stats.avgProcessingTime,
          threshold: this.config.monitoring.alertThresholds.avgProcessingTime
        }
      })
    }
  }
  
  getProcessorStats() {
    const totalJobs = this.jobQueue.size + this.runningJobs.size + this.completedJobs.size + this.failedJobs.size
    const completedCount = this.completedJobs.size
    const failedCount = this.failedJobs.size
    
    // Calculate average processing time for completed jobs
    let totalProcessingTime = 0
    let processedJobs = 0
    
    for (const job of this.completedJobs.values()) {
      if (job.timestamps.startedAt && job.timestamps.completedAt) {
        totalProcessingTime += job.timestamps.completedAt - job.timestamps.startedAt
        processedJobs++
      }
    }
    
    return {
      queueDepth: this.jobQueue.size,
      runningJobs: this.runningJobs.size,
      completedJobs: completedCount,
      failedJobs: failedCount,
      totalJobs,
      failureRate: totalJobs > 0 ? failedCount / totalJobs : 0,
      avgProcessingTime: processedJobs > 0 ? totalProcessingTime / processedJobs : 0,
      isRunning: this.isRunning
    }
  }
  
  // Persistence
  private startPersistence(): void {
    if (!this.config.persistence.enableJobPersistence) return
    
    this.persistenceTimer = setInterval(() => {
      this.saveJobState()
    }, this.config.persistence.saveInterval)
  }
  
  private saveJobState(): void {
    // In a real implementation, this would save to a database or file
    const state = {
      timestamp: Date.now(),
      queuedJobs: Array.from(this.jobQueue.values()),
      runningJobs: Array.from(this.runningJobs.values()),
      completedJobs: Array.from(this.completedJobs.values()).slice(-100), // Keep last 100
      failedJobs: Array.from(this.failedJobs.values()).slice(-100) // Keep last 100
    }
    
    logger.debug('Job state saved', {
      category: 'persistence',
      component: 'background-job-processor',
      metadata: {
        queuedCount: state.queuedJobs.length,
        runningCount: state.runningJobs.length,
        completedCount: state.completedJobs.length,
        failedCount: state.failedJobs.length
      }
    })
  }
  
  // Processor registration
  registerProcessor(jobType: Job['type'], processor: JobProcessor): void {
    this.processors.set(jobType, processor)
    
    logger.info('Job processor registered', {
      category: 'system_configuration',
      component: 'background-job-processor',
      metadata: { jobType }
    })
  }
  
  unregisterProcessor(jobType: Job['type']): void {
    this.processors.delete(jobType)
    
    logger.info('Job processor unregistered', {
      category: 'system_configuration',
      component: 'background-job-processor',
      metadata: { jobType }
    })
  }
}

// Built-in job processors

class WorkflowExecutionProcessor implements JobProcessor {
  async process(job: Job): Promise<JobResult> {
    try {
      const executionContext = job.payload as ExecutionContext
      
      // Execute workflow using execution engine
      const result = await executionEngine.executeWorkflow(executionContext)
      
      return {
        success: true,
        result,
        metadata: {
          executionId: result.executionId,
          status: result.status,
          duration: result.timing.duration,
          tokenUsage: result.resources.totalTokensUsed,
          cost: result.resources.totalCostIncurred
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          stack: (error as Error).stack,
          retryable: true
        }
      }
    }
  }
}

class BatchExecutionProcessor implements JobProcessor {
  async process(job: Job): Promise<JobResult> {
    const { items, batchSize = 10 } = job.payload
    
    if (!Array.isArray(items)) {
      return {
        success: false,
        error: {
          name: 'ValidationError',
          message: 'Batch job payload must contain an array of items',
          retryable: false
        }
      }
    }
    
    const results = []
    const batches = this.chunkArray(items, batchSize)
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      const batchResults = await Promise.allSettled(
        batch.map(item => this.processItem(item))
      )
      
      results.push(...batchResults)
      
      // Update progress
      const progress = Math.floor(((i + 1) / batches.length) * 100)
      // Would emit progress update here
    }
    
    const successful = results.filter(r => r.status === 'fulfilled').length
    const failed = results.length - successful
    
    return {
      success: true,
      result: {
        totalItems: items.length,
        successful,
        failed,
        results: results.map(r => r.status === 'fulfilled' ? r.value : r.reason)
      }
    }
  }
  
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }
  
  private async processItem(item: any): Promise<any> {
    // Mock item processing
    await new Promise(resolve => setTimeout(resolve, Math.random() * 1000))
    return { processed: true, item, timestamp: Date.now() }
  }
}

class CleanupTaskProcessor implements JobProcessor {
  async process(job: Job): Promise<JobResult> {
    const { taskType, parameters } = job.payload
    
    try {
      switch (taskType) {
        case 'old_executions':
          return await this.cleanupOldExecutions(parameters)
        case 'expired_tokens':
          return await this.cleanupExpiredTokens(parameters)
        case 'temp_files':
          return await this.cleanupTempFiles(parameters)
        default:
          throw new Error(`Unknown cleanup task type: ${taskType}`)
      }
    } catch (error) {
      return {
        success: false,
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          retryable: true
        }
      }
    }
  }
  
  private async cleanupOldExecutions(params: any): Promise<JobResult> {
    // Mock cleanup implementation
    const cutoffTime = Date.now() - (params.olderThanDays * 24 * 60 * 60 * 1000)
    const deletedCount = Math.floor(Math.random() * 100)
    
    return {
      success: true,
      result: {
        deletedExecutions: deletedCount,
        cutoffTime
      }
    }
  }
  
  private async cleanupExpiredTokens(params: any): Promise<JobResult> {
    // Mock token cleanup
    const deletedTokens = Math.floor(Math.random() * 50)
    
    return {
      success: true,
      result: { deletedTokens }
    }
  }
  
  private async cleanupTempFiles(params: any): Promise<JobResult> {
    // Mock file cleanup
    const deletedFiles = Math.floor(Math.random() * 200)
    const freedSpace = deletedFiles * 1024 * 1024 // MB
    
    return {
      success: true,
      result: {
        deletedFiles,
        freedSpaceBytes: freedSpace
      }
    }
  }
}

class AnalyticsComputationProcessor implements JobProcessor {
  async process(job: Job): Promise<JobResult> {
    const { computation, timeRange, filters } = job.payload
    
    try {
      // Mock analytics computation
      await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 3000))
      
      const result = {
        computation,
        timeRange,
        metrics: {
          totalExecutions: Math.floor(Math.random() * 1000),
          avgExecutionTime: Math.floor(Math.random() * 60000),
          successRate: Math.random(),
          topAgents: [
            { id: 'agent-1', executions: Math.floor(Math.random() * 100) },
            { id: 'agent-2', executions: Math.floor(Math.random() * 100) }
          ]
        },
        generatedAt: Date.now()
      }
      
      return {
        success: true,
        result
      }
      
    } catch (error) {
      return {
        success: false,
        error: {
          name: (error as Error).name,
          message: (error as Error).message,
          retryable: true
        }
      }
    }
  }
}

// Global background job processor instance
export const backgroundJobProcessor = new BackgroundJobProcessor()

// Utility functions
export const addBackgroundJob = async (
  type: Job['type'], 
  payload: Record<string, any>,
  options: Partial<Omit<Job, 'id' | 'type' | 'payload' | 'timestamps' | 'history'>> = {}
): Promise<string> => {
  const jobData: Omit<Job, 'id' | 'timestamps' | 'history'> = {
    type,
    status: 'pending',
    priority: options.priority || 'normal',
    payload,
    scheduling: {
      scheduledAt: Date.now(),
      ...options.scheduling,
      recurring: {
        enabled: false,
        ...options.scheduling?.recurring
      }
    },
    config: {
      timeout: 3600000,
      maxRetries: 3,
      retryDelay: 5000,
      concurrency: 1,
      ...options.config
    },
    dependencies: options.dependencies || [],
    dependents: options.dependents || [],
    progress: { percentage: 0 },
    metadata: {
      tags: [],
      childJobIds: [],
      ...options.metadata
    }
  }
  
  return backgroundJobProcessor.addJob(jobData)
}

export const getJobStatus = async (jobId: string): Promise<Job | null> => {
  return backgroundJobProcessor.getJob(jobId)
}

export const cancelBackgroundJob = async (jobId: string, reason?: string): Promise<boolean> => {
  return backgroundJobProcessor.cancelJob(jobId, reason)
}

export const getProcessorStatistics = () => {
  return backgroundJobProcessor.getProcessorStats()
}

// Worker class for distributed processing
class Worker {
  constructor(
    private id: string,
    private processor: BackgroundJobProcessor
  ) {}
  
  async start(): Promise<void> {
    // Worker implementation would go here
  }
  
  async stop(): Promise<void> {
    // Worker cleanup would go here
  }
}

export default {
  BackgroundJobProcessor,
  backgroundJobProcessor,
  addBackgroundJob,
  getJobStatus,
  cancelBackgroundJob,
  getProcessorStatistics
}