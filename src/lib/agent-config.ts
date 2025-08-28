// src/lib/agent-config.ts

import { z } from 'zod'

// Agent role definitions with capabilities and responsibilities
export const AGENT_ROLES = {
  planner: {
    name: 'Planner',
    description: 'Design agentic AI structures, create hierarchies, reshape team organization',
    capabilities: [
      'structure_design',
      'hierarchy_creation', 
      'team_organization',
      'workflow_planning',
      'resource_allocation'
    ],
    defaultProtocols: [
      'hierarchical_planning',
      'collaborative_design',
      'iterative_refinement'
    ]
  },
  director: {
    name: 'Director',
    description: 'Strategic decisions, project oversight, resource authorization, final approvals',
    capabilities: [
      'strategic_oversight',
      'resource_authorization',
      'final_approval',
      'risk_assessment',
      'quality_control'
    ],
    defaultProtocols: [
      'executive_decision',
      'approval_workflow',
      'strategic_review'
    ]
  },
  coordinator: {
    name: 'Coordinator',
    description: 'Team management, timeline handling, quality standards, expert allocation',
    capabilities: [
      'team_management',
      'timeline_coordination',
      'quality_assurance',
      'resource_scheduling',
      'progress_tracking'
    ],
    defaultProtocols: [
      'coordination_hub',
      'status_reporting',
      'conflict_resolution'
    ]
  },
  expert: {
    name: 'Expert',
    description: 'Domain leadership, task distribution, progress tracking, integration management',
    capabilities: [
      'domain_expertise',
      'task_distribution',
      'technical_guidance',
      'integration_management',
      'knowledge_synthesis'
    ],
    defaultProtocols: [
      'expert_consultation',
      'technical_review',
      'knowledge_transfer'
    ]
  },
  builder: {
    name: 'Builder',
    description: 'Implementation execution, problem solving, system integration',
    capabilities: [
      'implementation',
      'problem_solving',
      'system_integration',
      'testing_validation',
      'documentation'
    ],
    defaultProtocols: [
      'execution_focused',
      'iterative_development',
      'continuous_testing'
    ]
  }
} as const

// Workflow patterns with execution strategies
export const WORKFLOW_PATTERNS = {
  sequential: {
    name: 'Sequential',
    description: 'Tasks execute one after another in order',
    strategy: 'linear_execution',
    coordination: 'handoff_based',
    suitableFor: ['ordered_workflows', 'dependency_heavy', 'step_by_step']
  },
  routing: {
    name: 'Routing',
    description: 'Tasks are routed to appropriate agents based on criteria',
    strategy: 'conditional_routing',
    coordination: 'rule_based',
    suitableFor: ['decision_trees', 'conditional_logic', 'specialized_routing']
  },
  parallel: {
    name: 'Parallel',
    description: 'Multiple tasks execute simultaneously',
    strategy: 'concurrent_execution',
    coordination: 'synchronization_points',
    suitableFor: ['independent_tasks', 'performance_critical', 'scalable_processing']
  },
  'orchestrator-worker': {
    name: 'Orchestrator-Worker',
    description: 'Central orchestrator distributes work to multiple workers',
    strategy: 'centralized_distribution',
    coordination: 'hub_and_spoke',
    suitableFor: ['large_scale_processing', 'load_balancing', 'centralized_control']
  },
  'evaluator-optimizer': {
    name: 'Evaluator-Optimizer',
    description: 'Continuous evaluation and optimization of results',
    strategy: 'feedback_loop',
    coordination: 'evaluation_based',
    suitableFor: ['quality_improvement', 'iterative_refinement', 'optimization_tasks']
  },
  'multi-step-tool': {
    name: 'Multi-Step Tool',
    description: 'Complex multi-step tool usage and coordination',
    strategy: 'tool_orchestration',
    coordination: 'tool_based',
    suitableFor: ['complex_toolchains', 'multi_system_integration', 'automated_workflows']
  }
} as const

// Protocol definitions for different roles and patterns
export const PROTOCOLS = {
  // Planner protocols
  hierarchical_planning: {
    name: 'Hierarchical Planning',
    description: 'Top-down planning with hierarchical decomposition',
    steps: ['analyze_requirements', 'create_hierarchy', 'define_relationships', 'validate_structure']
  },
  collaborative_design: {
    name: 'Collaborative Design',
    description: 'Multi-agent collaborative structure design',
    steps: ['gather_input', 'collaborative_ideation', 'consensus_building', 'design_validation']
  },
  iterative_refinement: {
    name: 'Iterative Refinement',
    description: 'Continuous improvement through iterations',
    steps: ['initial_design', 'feedback_collection', 'refinement_cycle', 'convergence_check']
  },

  // Director protocols
  executive_decision: {
    name: 'Executive Decision',
    description: 'High-level strategic decision making',
    steps: ['information_gathering', 'risk_assessment', 'decision_matrix', 'authorization']
  },
  approval_workflow: {
    name: 'Approval Workflow',
    description: 'Structured approval process with checkpoints',
    steps: ['review_submission', 'quality_check', 'stakeholder_approval', 'final_authorization']
  },
  strategic_review: {
    name: 'Strategic Review',
    description: 'Comprehensive strategic analysis and review',
    steps: ['context_analysis', 'strategic_alignment', 'impact_assessment', 'recommendation']
  },

  // Coordinator protocols
  coordination_hub: {
    name: 'Coordination Hub',
    description: 'Central coordination and communication hub',
    steps: ['status_collection', 'conflict_detection', 'resource_allocation', 'synchronization']
  },
  status_reporting: {
    name: 'Status Reporting',
    description: 'Regular status updates and progress tracking',
    steps: ['data_collection', 'progress_analysis', 'report_generation', 'stakeholder_notification']
  },
  conflict_resolution: {
    name: 'Conflict Resolution',
    description: 'Systematic conflict resolution process',
    steps: ['conflict_identification', 'stakeholder_mediation', 'solution_development', 'resolution_implementation']
  },

  // Expert protocols
  expert_consultation: {
    name: 'Expert Consultation',
    description: 'Domain expert consultation and guidance',
    steps: ['problem_analysis', 'expertise_application', 'solution_development', 'knowledge_transfer']
  },
  technical_review: {
    name: 'Technical Review',
    description: 'Comprehensive technical review and validation',
    steps: ['technical_analysis', 'standard_compliance', 'quality_assessment', 'improvement_recommendations']
  },
  knowledge_transfer: {
    name: 'Knowledge Transfer',
    description: 'Systematic knowledge sharing and transfer',
    steps: ['knowledge_documentation', 'transfer_planning', 'training_delivery', 'competency_validation']
  },

  // Builder protocols
  execution_focused: {
    name: 'Execution Focused',
    description: 'Direct implementation and execution',
    steps: ['requirement_analysis', 'implementation_planning', 'execution', 'validation']
  },
  iterative_development: {
    name: 'Iterative Development',
    description: 'Iterative build-test-refine cycle',
    steps: ['increment_planning', 'implementation', 'testing', 'feedback_integration']
  },
  continuous_testing: {
    name: 'Continuous Testing',
    description: 'Continuous testing and quality assurance',
    steps: ['test_planning', 'continuous_execution', 'result_analysis', 'improvement_implementation']
  }
} as const

// Agent definition schema
export const agentDefinitionSchema = z.object({
  name: z.string().min(1, 'Agent name is required'),
  description: z.string().optional(),
  role: z.enum(['planner', 'director', 'coordinator', 'expert', 'builder']),
  protocol: z.string().min(1, 'Protocol selection is required'),
  workflowPattern: z.enum([
    'sequential',
    'routing',
    'parallel',
    'orchestrator-worker',
    'evaluator-optimizer',
    'multi-step-tool'
  ]),
  capabilities: z.array(z.string()).default([]),
  customCapabilities: z.array(z.string()).default([])
})

export type AgentDefinition = z.infer<typeof agentDefinitionSchema>

// Helper functions for agent configuration
export const getAvailableProtocols = (role: keyof typeof AGENT_ROLES) => {
  return AGENT_ROLES[role].defaultProtocols
}

export const getAvailableCapabilities = (role: keyof typeof AGENT_ROLES) => {
  return AGENT_ROLES[role].capabilities
}

export const getWorkflowPatternInfo = (pattern: keyof typeof WORKFLOW_PATTERNS) => {
  return WORKFLOW_PATTERNS[pattern]
}

export const getProtocolInfo = (protocolKey: string) => {
  return PROTOCOLS[protocolKey as keyof typeof PROTOCOLS]
}

export const validateRoleProtocolCombination = (role: keyof typeof AGENT_ROLES, protocol: string) => {
  const availableProtocols = Object.keys(PROTOCOLS) as (keyof typeof PROTOCOLS)[]
  const roleProtocols = [...AGENT_ROLES[role].defaultProtocols]
  
  return availableProtocols.some(key => 
    roleProtocols.includes(key) && key === protocol
  ) || Object.values(PROTOCOLS).some(p => p.name.toLowerCase().replace(/\s+/g, '_') === protocol)
}