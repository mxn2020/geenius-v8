// src/components/Dashboard/Dashboard.tsx - Updated for new backend

import React from 'react';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useSession } from '~/lib/auth-client';
import { StatsCards } from './StatsCards';
import { QuickActions } from './QuickActions';
import { userQueries } from '../../queries';

export function Dashboard() {
  const { data: session } = useSession();

  // Get user data with new API
  const userQuery = useSuspenseQuery(
    userQueries.byAuthId(session?.user?.id || '')
  );

  const user = userQuery.data;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 bg-gray-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome back, {user?.name || session?.user?.name}
        </h1>
        <p className="text-lg text-gray-600">
          Here's an overview of your AI agent management progress
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-8 space-y-8">
          <StatsCards />
        </div>

        {/* Right Column - Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <QuickActions />
        </div>
      </div>
    </div>
  );
}