// src/lib/memory-management.ts

import { z } from 'zod'

// Memory types and storage strategies
export const MEMORY_TYPES = {
  short_term: {
    name: 'Short Term',
    description: 'Immediate context within current conversation',
    retention: 'session',
    maxSize: 4096,
    storageStrategy: 'in_memory'
  },
  working: {
    name: 'Working Memory',
    description: 'Active information being processed',
    retention: 'task',
    maxSize: 8192,
    storageStrategy: 'session_cache'
  },
  episodic: {
    name: 'Episodic',
    description: 'Specific events and experiences',
    retention: 'permanent',
    maxSize: 32768,
    storageStrategy: 'database'
  },
  semantic: {
    name: 'Semantic',
    description: 'Facts, knowledge, and learned information',
    retention: 'permanent',
    maxSize: 65536,
    storageStrategy: 'vector_database'
  },
  procedural: {
    name: 'Procedural',
    description: 'Skills, procedures, and how-to knowledge',
    retention: 'permanent',
    maxSize: 16384,
    storageStrategy: 'structured_storage'
  }
} as const

// Memory sharing protocols between agents
export const SHARING_PROTOCOLS = {
  private: {
    name: 'Private',
    description: 'Memory not shared with other agents',
    access: 'self_only',
    security: 'high'
  },
  team_shared: {
    name: 'Team Shared',
    description: 'Shared within agent team/structure',
    access: 'team_members',
    security: 'medium'
  },
  hierarchical: {
    name: 'Hierarchical',
    description: 'Shared up/down the hierarchy',
    access: 'hierarchy_based',
    security: 'medium'
  },
  global_shared: {
    name: 'Global Shared',
    description: 'Shared with all agents in project',
    access: 'project_wide',
    security: 'low'
  },
  selective: {
    name: 'Selective',
    description: 'Shared with specific agents only',
    access: 'whitelist_based',
    security: 'configurable'
  }
} as const

// Context injection strategies
export const CONTEXT_INJECTION_STRATEGIES = {
  append: {
    name: 'Append',
    description: 'Add context to the end of the prompt',
    position: 'end',
    format: 'raw'
  },
  prepend: {
    name: 'Prepend',
    description: 'Add context to the beginning of the prompt',
    position: 'start',
    format: 'raw'
  },
  structured: {
    name: 'Structured',
    description: 'Inject context in structured format with labels',
    position: 'contextual',
    format: 'structured'
  },
  summarized: {
    name: 'Summarized',
    description: 'Inject summarized version of context',
    position: 'contextual',
    format: 'compressed'
  },
  relevant_only: {
    name: 'Relevant Only',
    description: 'Inject only context relevant to current task',
    position: 'contextual',
    format: 'filtered'
  }
} as const

// Memory configuration schema
export const memoryConfigSchema = z.object({
  contextWindow: z.number().positive().default(8192),
  memoryPersistence: z.boolean().default(true),
  memoryTypes: z.object({
    shortTerm: z.object({
      enabled: z.boolean().default(true),
      maxSize: z.number().positive().default(4096),
      retention: z.enum(['session', 'task', 'permanent']).default('session')
    }).default({
      enabled: true,
      maxSize: 4096,
      retention: 'session'
    }),
    working: z.object({
      enabled: z.boolean().default(true),
      maxSize: z.number().positive().default(8192),
      retention: z.enum(['session', 'task', 'permanent']).default('task')
    }).default({
      enabled: true,
      maxSize: 8192,
      retention: 'task'
    }),
    episodic: z.object({
      enabled: z.boolean().default(true),
      maxSize: z.number().positive().default(32768),
      retention: z.enum(['session', 'task', 'permanent']).default('permanent')
    }).default({
      enabled: true,
      maxSize: 32768,
      retention: 'permanent'
    }),
    semantic: z.object({
      enabled: z.boolean().default(true),
      maxSize: z.number().positive().default(65536),
      retention: z.enum(['session', 'task', 'permanent']).default('permanent')
    }).default({
      enabled: true,
      maxSize: 65536,
      retention: 'permanent'
    }),
    procedural: z.object({
      enabled: z.boolean().default(false),
      maxSize: z.number().positive().default(16384),
      retention: z.enum(['session', 'task', 'permanent']).default('permanent')
    }).default({
      enabled: false,
      maxSize: 16384,
      retention: 'permanent'
    })
  }).default({
    shortTerm: {
      enabled: true,
      maxSize: 4096,
      retention: 'session'
    },
    working: {
      enabled: true,
      maxSize: 8192,
      retention: 'task'
    },
    episodic: {
      enabled: true,
      maxSize: 32768,
      retention: 'permanent'
    },
    semantic: {
      enabled: true,
      maxSize: 65536,
      retention: 'permanent'
    },
    procedural: {
      enabled: false,
      maxSize: 16384,
      retention: 'permanent'
    }
  }),
  sharingProtocols: z.array(z.enum([
    'private',
    'team_shared',
    'hierarchical',
    'global_shared',
    'selective'
  ])).default(['private']),
  contextInjection: z.object({
    strategy: z.enum([
      'append',
      'prepend', 
      'structured',
      'summarized',
      'relevant_only'
    ]).default('structured'),
    maxContextSize: z.number().positive().default(2048),
    relevanceThreshold: z.number().min(0).max(1).default(0.7),
    compressionRatio: z.number().min(0.1).max(1).default(0.5)
  }).default({
    strategy: 'structured',
    maxContextSize: 2048,
    relevanceThreshold: 0.7,
    compressionRatio: 0.5
  }),
  persistence: z.object({
    enableVectorStorage: z.boolean().default(false),
    enableSemanticSearch: z.boolean().default(false),
    indexingStrategy: z.enum(['immediate', 'batch', 'scheduled']).default('batch'),
    retentionPolicy: z.object({
      shortTerm: z.number().positive().default(3600), // 1 hour in seconds
      working: z.number().positive().default(86400), // 1 day in seconds
      episodic: z.number().positive().default(2592000), // 30 days in seconds
      semantic: z.number().positive().default(-1), // permanent
      procedural: z.number().positive().default(-1) // permanent
    }).default({
      shortTerm: 3600,
      working: 86400,
      episodic: 2592000,
      semantic: -1,
      procedural: -1
    })
  }).default({
    enableVectorStorage: false,
    enableSemanticSearch: false,
    indexingStrategy: 'batch',
    retentionPolicy: {
      shortTerm: 3600,
      working: 86400,
      episodic: 2592000,
      semantic: -1,
      procedural: -1
    }
  })
})

export type MemoryConfig = z.infer<typeof memoryConfigSchema>

// Memory entry schema for storage
export const memoryEntrySchema = z.object({
  id: z.string(),
  agentId: z.string(),
  executionId: z.string().optional(),
  type: z.enum(['short_term', 'working', 'episodic', 'semantic', 'procedural']),
  content: z.string(),
  metadata: z.object({
    timestamp: z.number(),
    relevanceScore: z.number().min(0).max(1).optional(),
    tags: z.array(z.string()).default([]),
    source: z.string().optional(),
    category: z.string().optional(),
    context: z.any().optional()
  }),
  sharing: z.object({
    protocol: z.enum(['private', 'team_shared', 'hierarchical', 'global_shared', 'selective']),
    allowedAgents: z.array(z.string()).default([]),
    expiresAt: z.number().optional()
  }),
  embedding: z.array(z.number()).optional(), // for vector search
  processed: z.boolean().default(false)
})

export type MemoryEntry = z.infer<typeof memoryEntrySchema>

// Context management utilities
export class ContextManager {
  private maxContextSize: number
  private relevanceThreshold: number
  
  constructor(config: MemoryConfig) {
    this.maxContextSize = config.contextInjection.maxContextSize
    this.relevanceThreshold = config.contextInjection.relevanceThreshold
  }
  
  injectContext(
    prompt: string,
    memories: MemoryEntry[],
    strategy: keyof typeof CONTEXT_INJECTION_STRATEGIES
  ): string {
    const relevantMemories = this.filterRelevantMemories(memories)
    const contextString = this.formatContext(relevantMemories, strategy)
    
    switch (strategy) {
      case 'prepend':
        return `${contextString}\n\n${prompt}`
      case 'append':
        return `${prompt}\n\n${contextString}`
      case 'structured':
        return this.injectStructuredContext(prompt, contextString)
      case 'summarized':
        return this.injectSummarizedContext(prompt, contextString)
      case 'relevant_only':
        return this.injectRelevantContext(prompt, relevantMemories)
      default:
        return prompt
    }
  }
  
  private filterRelevantMemories(memories: MemoryEntry[]): MemoryEntry[] {
    return memories
      .filter(memory => 
        !memory.metadata.relevanceScore || 
        memory.metadata.relevanceScore >= this.relevanceThreshold
      )
      .sort((a, b) => 
        (b.metadata.relevanceScore || 0) - (a.metadata.relevanceScore || 0)
      )
      .slice(0, this.calculateMaxMemories())
  }
  
  private calculateMaxMemories(): number {
    // Estimate based on average memory size and max context size
    const avgMemorySize = 200 // rough estimate
    return Math.floor(this.maxContextSize / avgMemorySize)
  }
  
  private formatContext(memories: MemoryEntry[], strategy: string): string {
    return memories
      .map(memory => {
        switch (strategy) {
          case 'structured':
            return `[${memory.type.toUpperCase()}] ${memory.content}`
          case 'summarized':
            return this.summarizeMemory(memory)
          default:
            return memory.content
        }
      })
      .join('\n')
  }
  
  private injectStructuredContext(prompt: string, context: string): string {
    return `## Context\n${context}\n\n## Current Task\n${prompt}`
  }
  
  private injectSummarizedContext(prompt: string, context: string): string {
    const summary = this.summarizeContext(context)
    return `## Background\n${summary}\n\n## Task\n${prompt}`
  }
  
  private injectRelevantContext(prompt: string, memories: MemoryEntry[]): string {
    const relevant = memories.slice(0, 3) // top 3 most relevant
    const contextString = relevant.map(m => m.content).join('\n')
    return `${contextString}\n\n${prompt}`
  }
  
  private summarizeMemory(memory: MemoryEntry): string {
    // Simple summarization - in real implementation, use AI summarization
    const words = memory.content.split(' ')
    if (words.length <= 50) return memory.content
    return words.slice(0, 30).join(' ') + '...'
  }
  
  private summarizeContext(context: string): string {
    // Simple context summarization
    const sentences = context.split('.').filter(s => s.trim().length > 0)
    if (sentences.length <= 3) return context
    return sentences.slice(0, 2).join('.') + '.'
  }
}

// Helper functions
export const getDefaultMemoryConfig = (role: string): MemoryConfig => {
  const roleDefaults = {
    planner: {
      contextWindow: 16384,
      memoryTypes: {
        semantic: { enabled: true, maxSize: 32768, retention: 'permanent' as const },
        episodic: { enabled: true, maxSize: 16384, retention: 'permanent' as const }
      },
      sharingProtocols: ['team_shared' as const, 'hierarchical' as const]
    },
    director: {
      contextWindow: 12288,
      memoryTypes: {
        episodic: { enabled: true, maxSize: 32768, retention: 'permanent' as const },
        semantic: { enabled: true, maxSize: 16384, retention: 'permanent' as const }
      },
      sharingProtocols: ['global_shared' as const, 'hierarchical' as const]
    },
    coordinator: {
      contextWindow: 10240,
      memoryTypes: {
        working: { enabled: true, maxSize: 16384, retention: 'task' as const },
        episodic: { enabled: true, maxSize: 24576, retention: 'permanent' as const }
      },
      sharingProtocols: ['team_shared' as const, 'hierarchical' as const]
    },
    expert: {
      contextWindow: 14336,
      memoryTypes: {
        semantic: { enabled: true, maxSize: 65536, retention: 'permanent' as const },
        procedural: { enabled: true, maxSize: 32768, retention: 'permanent' as const }
      },
      sharingProtocols: ['team_shared' as const, 'selective' as const]
    },
    builder: {
      contextWindow: 8192,
      memoryTypes: {
        working: { enabled: true, maxSize: 12288, retention: 'task' as const },
        procedural: { enabled: true, maxSize: 16384, retention: 'permanent' as const }
      },
      sharingProtocols: ['private' as const, 'team_shared' as const]
    }
  }
  
  const defaults = roleDefaults[role as keyof typeof roleDefaults] || {}
  
  return {
    contextWindow: defaults.contextWindow || 8192,
    memoryPersistence: true,
    memoryTypes: {
      shortTerm: { enabled: true, maxSize: 4096, retention: 'session' },
      working: { enabled: true, maxSize: 8192, retention: 'task' },
      episodic: { enabled: true, maxSize: 32768, retention: 'permanent' },
      semantic: { enabled: true, maxSize: 65536, retention: 'permanent' },
      procedural: { enabled: false, maxSize: 16384, retention: 'permanent' },
      ...defaults.memoryTypes
    },
    sharingProtocols: defaults.sharingProtocols || ['private'],
    contextInjection: {
      strategy: 'structured',
      maxContextSize: 2048,
      relevanceThreshold: 0.7,
      compressionRatio: 0.5
    },
    persistence: {
      enableVectorStorage: false,
      enableSemanticSearch: false,
      indexingStrategy: 'batch',
      retentionPolicy: {
        shortTerm: 3600,
        working: 86400,
        episodic: 2592000,
        semantic: -1,
        procedural: -1
      }
    }
  }
}

export const validateMemoryConfig = (config: MemoryConfig) => {
  const errors: string[] = []
  
  // Validate total memory size doesn't exceed context window
  const totalMemorySize = Object.values(config.memoryTypes)
    .filter(type => type.enabled)
    .reduce((sum, type) => sum + type.maxSize, 0)
    
  if (totalMemorySize > config.contextWindow * 0.8) { // Leave 20% for prompt
    errors.push(`Total memory size (${totalMemorySize}) exceeds 80% of context window (${config.contextWindow})`)
  }
  
  // Validate context injection size
  if (config.contextInjection.maxContextSize > config.contextWindow * 0.5) {
    errors.push(`Context injection size too large for context window`)
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

export const createMemoryEntry = (
  agentId: string,
  content: string,
  type: MemoryEntry['type'],
  options: Partial<MemoryEntry> = {}
): MemoryEntry => {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    agentId,
    content,
    type,
    metadata: {
      timestamp: Date.now(),
      tags: [],
      ...options.metadata
    },
    sharing: {
      protocol: 'private',
      allowedAgents: [],
      ...options.sharing
    },
    processed: false,
    ...options
  }
}