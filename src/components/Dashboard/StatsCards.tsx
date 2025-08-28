import React from 'react';
import { CheckCircle, ClipboardList, BarChart3, Target } from 'lucide-react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { convexQuery } from '@convex-dev/react-query';
import { api } from 'convex/_generated/api';
import { useSession } from '~/lib/auth-client';
import type { Board } from 'convex/schema.js';

export function StatsCards() {
  const { data: session } = useSession();
  
  // Get user data
  const userQuery = useSuspenseQuery(
    convexQuery(api.users.getUserByAuthId, {
      authUserId: session?.user?.id || '',
    })
  );

  // Get user's boards
  const boardsQuery = useSuspenseQuery(
    convexQuery(api.board.getBoards, {})
  );

  const user = userQuery.data;
  const boards = boardsQuery.data || [];
  
  const userBoards = boards.filter((b) => b.createdBy === session?.user?.id);
  
  const stats = [
    {
      label: 'Tasks Completed',
      value: user?.tasksCompleted || 0,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      change: '+5 this week',
      changeColor: 'text-green-700',
    },
    {
      label: 'Tasks Assigned',
      value: user?.tasksAssigned || 0,
      icon: ClipboardList,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      change: '+3 this week',
      changeColor: 'text-blue-700',
    },
    {
      label: 'Active Boards',
      value: userBoards.length,
      icon: BarChart3,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
      change: '2 boards',
      changeColor: 'text-indigo-700',
    },
    {
      label: 'Productivity Score',
      value: user?.karmaLevel || 0,
      icon: Target,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      change: '+12 this week',
      changeColor: 'text-purple-700',
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