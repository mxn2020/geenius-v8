import { useState } from 'react';
import { User, Bell, Search, Plus, LogOut, BarChart3, Bot, Zap, Briefcase } from 'lucide-react';
import { Link, useLocation } from '@tanstack/react-router';
import { useSession, signOut } from '~/lib/auth-client';
import { NotificationsDropdown } from './NotificationsDropdown';

export function Header() {
  const location = useLocation();
  const session = useSession();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const navigationItems = [
    { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'projects', path: '/projects', label: 'Projects', icon: Briefcase },
    { id: 'agents', path: '/agents', label: 'Agents', icon: Bot },
    { id: 'executions', path: '/executions', label: 'Executions', icon: Zap },
  ];

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
                <span className="text-xl text-white font-bold">G</span>
              </div>
              <span className="text-2xl font-bold text-gray-900 tracking-tight">Geenius</span>
            </div>
            
            {/* Navigation */}
            <nav className="hidden md:flex space-x-1 ml-8">
              {navigationItems.map((item) => {
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.id}
                    to={item.path}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                      location.pathname === item.path
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <IconComponent className="h-4 w-4 mr-2" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Search Bar */}
          <div className="flex-1 max-w-md mx-8 hidden lg:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <input
                type="text"
                placeholder="Search projects, agents, executions..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors placeholder-gray-400 text-gray-900"
              />
            </div>
          </div>

          {/* Right side actions */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors relative"
              >
                <Bell className="h-5 w-5" />
                {/* Simplified notification badge without hook dependency */}
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full hidden"></div>
              </button>
              
              <NotificationsDropdown 
                isOpen={isNotificationsOpen}
                onClose={() => setIsNotificationsOpen(false)}
              />
            </div>
            
            <Link
              to="/projects/new"
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors font-medium"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Project</span>
            </Link>
            
            {session.data && (
              <div className="flex items-center space-x-3">
                <div className="text-right hidden sm:block">
                  <div className="text-sm font-medium text-gray-900">
                    {session.data.user.name || session.data.user.email}
                  </div>
                  <div className="text-xs text-gray-500">Admin</div>
                </div>
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4 text-gray-600" />
                </div>
                <button 
                  onClick={handleLogout}
                  className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile Navigation */}
      <div className="md:hidden border-t border-gray-200">
        <nav className="flex justify-around py-2">
          {navigationItems.map((item) => {
            const IconComponent = item.icon;
            return (
              <Link
                key={item.id}
                to={item.path}
                className={`flex flex-col items-center py-3 px-4 rounded-lg transition-colors ${
                  location.pathname === item.path
                    ? 'text-indigo-600 bg-indigo-50'
                    : 'text-gray-600'
                }`}
              >
                <IconComponent className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}