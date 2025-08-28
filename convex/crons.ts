// convex/crons.ts - Clean cron job definitions
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Fix schema issues on startup (run once)
crons.cron(
  'fix user schema issues',
  '0 0 * * *', // Daily at midnight (will only fix users that need it)
  internal.maintenance.fixUserSchemaIssues
)

// Clean up old executions every hour
crons.cron(
  'cleanup old executions',
  '0 * * * *', // Every hour at minute 0
  internal.maintenance.cleanupOldExecutions
)

// Clean up performance metrics every 6 hours
crons.cron(
  'cleanup performance metrics',
  '0 */6 * * *', // Every 6 hours
  internal.maintenance.cleanupPerformanceMetrics
)

// Clean up token usage records every day at 2 AM
crons.cron(
  'cleanup token usage',
  '0 2 * * *', // Daily at 2 AM
  internal.maintenance.cleanupTokenUsage
)

// Clean up audit logs every week
crons.cron(
  'cleanup audit logs',
  '0 3 * * 0', // Weekly on Sunday at 3 AM
  internal.maintenance.cleanupAuditLogs
)

// Update agent performance scores every hour
crons.cron(
  'update agent performance',
  '30 * * * *', // Every hour at minute 30
  internal.maintenance.updateAgentPerformanceScores
)

// Archive old projects every day at 4 AM
crons.cron(
  'archive old projects',
  '0 4 * * *', // Daily at 4 AM
  internal.maintenance.archiveOldProjects
)

// Clean cache every 30 minutes
crons.cron(
  'clean cache',
  '*/30 * * * *', // Every 30 minutes
  internal.maintenance.cleanCache
)

export default crons