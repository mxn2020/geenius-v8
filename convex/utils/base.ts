// convex/utils/base.ts - Core utilities and error handling
import { QueryCtx, MutationCtx } from '../_generated/server'
import { Id, Doc, TableNames } from '../_generated/dataModel'

// Custom Error Classes
export class EntityNotFoundError extends Error {
  constructor(entityType: string, id: string) {
    super(`${entityType} not found: ${id}`)
    this.name = 'EntityNotFoundError'
  }
}

export class UnauthorizedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ValidationError extends Error {
  constructor(message: string, field?: string) {
    super(field ? `Validation failed for ${field}: ${message}` : message)
    this.name = 'ValidationError'
  }
}

export class BusinessLogicError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BusinessLogicError'
  }
}

// Generic entity validator with proper Convex types
export async function ensureEntityExists<T extends TableNames>(
  ctx: QueryCtx,
  table: T,
  id: Id<T>,
  entityName?: string
): Promise<Doc<T>> {
  const entity = await ctx.db.get(id)
  if (!entity) {
    throw new EntityNotFoundError(entityName || table, id)
  }
  return entity
}

// Project access validator
export async function ensureProjectAccess(
  ctx: QueryCtx,
  projectId: Id<'projects'>,
  authUserId?: string
): Promise<Doc<'projects'>> {
  const project = await ensureEntityExists(ctx, 'projects', projectId, 'Project')
  
  if (authUserId && project.createdBy !== authUserId) {
    throw new UnauthorizedError(`Access denied to project ${projectId}`)
  }
  
  return project
}

// Agent access validator (checks both agent exists and project access)
export async function ensureAgentAccess(
  ctx: QueryCtx,
  agentId: Id<'agents'>,
  authUserId?: string
): Promise<{ agent: Doc<'agents'>; project: Doc<'projects'> }> {
  const agent = await ensureEntityExists(ctx, 'agents', agentId, 'Agent')
  const project = await ensureProjectAccess(ctx, agent.projectId, authUserId)
  
  return { agent, project }
}

// Pagination helpers
export function validatePagination(args: any) {
  const limit = Math.min(Math.max(args.limit || 20, 1), 100)
  const offset = Math.max(args.offset || 0, 0)
  return { limit, offset }
}

export function validateCursorPagination(args: any) {
  const limit = Math.min(Math.max(args.limit || 20, 1), 100)
  return { limit, cursor: args.cursor }
}

// Date range validation
export function validateDateRange(range?: { start: number; end: number }) {
  if (!range) return null
  
  if (range.start >= range.end) {
    throw new ValidationError('Start date must be before end date', 'dateRange')
  }
  
  const now = Date.now()
  const maxFuture = now + 24 * 60 * 60 * 1000 // 1 day
  
  if (range.end > maxFuture) {
    throw new ValidationError('End date cannot be more than 1 day in the future', 'dateRange')
  }
  
  return range
}

// Standard response wrapper
export interface PaginatedResponse<T> {
  data: T[]
  hasMore: boolean
  total?: number
  nextCursor?: string
}

export interface CursorPaginatedResponse<T> {
  data: T[]
  hasMore: boolean
  nextCursor?: string
}

// Performance calculation helpers
export function calculateExecutionMetrics(executions: Doc<'executions'>[]) {
  const total = executions.length
  const successful = executions.filter(e => e.status === 'completed').length
  const failed = executions.filter(e => e.status === 'failed').length
  const running = executions.filter(e => e.status === 'running').length
  
  const completedExecutions = executions.filter(e => e.completedAt && e.startedAt)
  const avgExecutionTime = completedExecutions.length > 0 
    ? completedExecutions.reduce((sum, e) => sum + (e.completedAt! - e.startedAt!), 0) / completedExecutions.length
    : 0

  return {
    total,
    successful,
    failed,
    running,
    successRate: total > 0 ? successful / total : 0,
    avgExecutionTime
  }
}

// Simple in-memory cache
const cache = new Map<string, { data: any; expiry: number }>()

export function withCache<T>(
  key: string, 
  ttlMs: number, 
  compute: () => Promise<T>
): Promise<T> {
  const now = Date.now()
  const cached = cache.get(key)
  
  if (cached && cached.expiry > now) {
    return Promise.resolve(cached.data)
  }
  
  return compute().then(data => {
    cache.set(key, { data, expiry: now + ttlMs })
    return data
  })
}

// Clean expired cache entries
export function cleanCache() {
  const now = Date.now()
  for (const [key, value] of cache.entries()) {
    if (value.expiry <= now) {
      cache.delete(key)
    }
  }
}

// Constants
export const DEFAULT_PAGINATION = {
  LIMIT: 20,
  MAX_LIMIT: 100
} as const

export const DEFAULT_TIMEOUTS = {
  EXECUTION: 1800000, // 30 minutes
  CLEANUP_DAYS: 30
} as const

export const CACHE_TTL = {
  SHORT: 5 * 60 * 1000,    // 5 minutes
  MEDIUM: 15 * 60 * 1000,  // 15 minutes
  LONG: 60 * 60 * 1000     // 1 hour
} as const