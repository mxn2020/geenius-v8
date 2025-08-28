// src/components/Dashboard/StatsCards.tsx - Updated for new backend

import React from 'react';
import { Bot, Zap, Activity, Target } from 'lucide-react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useSession } from '~/lib/auth-client';
import { userQueries, projectQueries, agentQueries, executionQueries } from '../../queries';

export function StatsCards() {
  const { data: session } = useSession();
  const authUserId = session?.user?.id || '';
  
  // Get user stats with new API
  const userStatsQuery = useSuspenseQuery(
    userQueries.stats(authUserId)
  );

  // Get user's projects 
  const projectsQuery = useSuspenseQuery(
    projectQueries.userProjects(authUserId, 50)
  );

  // Get user's agents
  const agentsQuery = useSuspenseQuery(
    agentQueries.list(undefined, authUserId, undefined, 50)
  );

  // Get recent executions
  const executionsQuery = useSuspenseQuery(
    executionQueries.list(undefined, undefined, authUserId, undefined, 50)
  );

  const userStats = userStatsQuery.data;
  const projects = projectsQuery.data?.data || [];
  const agents = agentsQuery.data?.data || [];
  const executions = executionsQuery.data?.data || [];

  const activeAgents = agents.filter(a => a.status === 'active').length;
  const runningExecutions = executions.filter(e => e.status === 'running').length;
  const completedExecutions = executions.filter(e => e.status === 'completed').length;
  const successRate = executions.length > 0 
    ? Math.round((completedExecutions / executions.length) * 100) 
    : 0;

  const stats = [
    {
      label: 'Active Projects',
      value: projects.filter(p => p.status === 'active').length,
      icon: Target,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      change: `${projects.length} total`,
      changeColor: 'text-blue-700',
    },
    {
      label: 'Active Agents',
      value: activeAgents,
      icon: Bot,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      change: `${agents.length} total`,
      changeColor: 'text-green-700',
    },
    {
      label: 'Running Executions',
      value: runningExecutions,
      icon: Zap,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      change: `${executions.length} total`,
      changeColor: 'text-purple-700',
    },
    {
      label: 'Success Rate',
      value: `${successRate}%`,
      icon: Activity,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      change: `${completedExecutions} completed`,
      changeColor: 'text-indigo-700',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat) => {
        const IconComponent = stat.icon;
        return (
          <div
            key={stat.label}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                <p className={`text-xs ${stat.changeColor} mt-1`}>{stat.change}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <IconComponent className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}