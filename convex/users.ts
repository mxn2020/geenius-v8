// convex/users.ts - Clean user management without legacy code
import { v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { ensureEntityExists, ValidationError } from './utils/base'

// Create or update user from auth sync
export const createOrUpdateUser = mutation({
  args: {
    authUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query('users')
      .withIndex('authUserId', (q) => q.eq('authUserId', args.authUserId))
      .first()

    const now = Date.now()

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        email: args.email,
        name: args.name,
        avatar: args.avatar,
        updatedAt: now,
      })
      return existingUser._id
    } else {
      // Create new user with default preferences
      const userId = await ctx.db.insert('users', {
        authUserId: args.authUserId,
        email: args.email,
        name: args.name,
        avatar: args.avatar,
        preferences: {
          theme: 'light',
          notifications: true,
          language: 'en',
        },
        createdBy: args.authUserId, // User creates themselves
        createdAt: now,
        updatedAt: now,
      })
      return userId
    }
  },
})

// Get user by auth ID
export const getUserByAuthId = query({
  args: { authUserId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('authUserId', (q) => q.eq('authUserId', args.authUserId))
      .first()
  },
})

// Get user by ID
export const getById = query({
  args: { id: v.id('users') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id)
  },
})

// Update user preferences
export const updatePreferences = mutation({
  args: {
    authUserId: v.string(),
    preferences: v.object({
      theme: v.optional(v.string()),
      notifications: v.optional(v.boolean()),
      language: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('authUserId', (q) => q.eq('authUserId', args.authUserId))
      .first()

    if (!user) {
      throw new ValidationError('User not found')
    }

    await ctx.db.patch(user._id, {
      preferences: {
        ...user.preferences,
        ...args.preferences,
      },
      updatedAt: Date.now(),
    })

    return user._id
  },
})

// Update user profile
export const updateProfile = mutation({
  args: {
    authUserId: v.string(),
    name: v.optional(v.string()),
    avatar: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('authUserId', (q) => q.eq('authUserId', args.authUserId))
      .first()

    if (!user) {
      throw new ValidationError('User not found')
    }

    const updateData: any = { updatedAt: Date.now() }
    if (args.name !== undefined) updateData.name = args.name
    if (args.avatar !== undefined) updateData.avatar = args.avatar

    await ctx.db.patch(user._id, updateData)
    return user._id
  },
})

// Delete user (for account deletion)
export const deleteUser = mutation({
  args: { authUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('authUserId', (q) => q.eq('authUserId', args.authUserId))
      .first()

    if (user) {
      await ctx.db.delete(user._id)
      return true
    }
    return false
  },
})

// Get all users (for admin features)
export const list = query({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit || 50, 100)
    const offset = args.offset || 0
    
    const users = await ctx.db
      .query('users')
      .order('desc')
      .collect()
    
    return {
      data: users.slice(offset, offset + limit),
      hasMore: users.length > offset + limit,
      total: users.length
    }
  },
})

// Get user statistics
export const getStats = query({
  args: { authUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query('users')
      .withIndex('authUserId', (q) => q.eq('authUserId', args.authUserId))
      .first()

    if (!user) {
      throw new ValidationError('User not found')
    }

    // Get user's projects
    const projects = await ctx.db
      .query('projects')
      .filter(q => q.eq(q.field('createdBy'), args.authUserId))
      .collect()

    // Get user's agents
    const agents = await ctx.db
      .query('agents')
      .filter(q => q.eq(q.field('createdBy'), args.authUserId))
      .collect()

    // Get user's executions
    const executions = await ctx.db
      .query('executions')
      .filter(q => q.eq(q.field('createdBy'), args.authUserId))
      .collect()

    const completedExecutions = executions.filter(e => e.status === 'completed').length
    const failedExecutions = executions.filter(e => e.status === 'failed').length

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        createdAt: user.createdAt
      },
      stats: {
        projectsCount: projects.length,
        agentsCount: agents.length,
        executionsCount: executions.length,
        completedExecutions,
        failedExecutions,
        successRate: executions.length > 0 
          ? completedExecutions / executions.length 
          : 0
      }
    }
  },
})