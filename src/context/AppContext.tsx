// src/context/AppContext.tsx - Simplified for new backend

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { ConvexUser } from '../types';

interface AppState {
  user: ConvexUser | null;
  currentView: 'dashboard' | 'projects' | 'agents' | 'executions' | 'profile';
}

type AppAction = 
  | { type: 'SET_USER'; payload: ConvexUser | null }
  | { type: 'SET_VIEW'; payload: AppState['currentView'] };

const initialState: AppState = {
  user: null,
  currentView: 'dashboard', // Default to dashboard for AI agent management
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };
    default:
      return state;
  }
}

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}