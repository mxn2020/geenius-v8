// src/components/Dashboard/QuickActions.tsx - Updated for new backend

import React from 'react';
import { Plus, Bot, Play, Settings } from 'lucide-react';
import { Link } from '@tanstack/react-router';

export function QuickActions() {
  const actions = [
    {
      label: 'Create Project',
      icon: Plus,
      description: 'Start a new AI agent project',
      color: 'bg-indigo-600 hover:bg-indigo-700',
      to: '/projects/new',
    },
    {
      label: 'Create Agent',
      icon: Bot,
      description: 'Build a new AI agent',
      color: 'bg-green-600 hover:bg-green-700',
      to: '/agents/new',
    },
    {
      label: 'Run Execution',
      icon: Play,
      description: 'Execute agent workflows',
      color: 'bg-purple-600 hover:bg-purple-700',
      to: '/executions/new',
    },
    {
      label: 'View Projects',
      icon: Settings,
      description: 'Manage all projects',
      color: 'bg-gray-600 hover:bg-gray-700',
      to: '/projects',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
      
      <div className="space-y-3">
        {actions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className={`w-full text-left p-4 rounded-lg ${action.color} text-white transition-colors hover:shadow-md group block`}
          >
            <div className="flex items-center">
              <action.icon className="h-5 w-5 mr-3 flex-shrink-0" />
              <div>
                <div className="font-medium text-sm">{action.label}</div>
                <div className="text-xs opacity-90 mt-1">{action.description}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}