import { useRef, useEffect } from 'react';
import { Bell, X, Heart, Users, Zap, Trophy } from 'lucide-react';
import { useNotifications } from '~/hooks/useNotifications';
import { Notification } from '~/types/exports';


interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationsDropdown({ isOpen, onClose }: Props) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead: markAllAsReadHook,
    deleteNotification: deleteNotificationHook,
    isLoading,
  } = useNotifications();


  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadHook();
  };

  const handleDeleteNotification = (notificationId: string) => {
    deleteNotificationHook(notificationId);
  };

  const getTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - timestamp.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'assignment':
        return <Zap className="h-5 w-5 text-orange-500" />;
      case 'completion':
        return <Trophy className="h-5 w-5 text-green-500" />;
      case 'achievement':
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 'reminder':
        return <Bell className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[80vh] overflow-hidden"
    >
      {/* Header */}
      <div className="bg-indigo-600 p-4 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Notifications</h3>
            <p className="text-indigo-100 text-sm">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-indigo-200 hover:text-white p-2 hover:bg-indigo-500 rounded-lg transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            disabled={isLoading}
            className="mt-3 bg-indigo-500 hover:bg-indigo-400 text-white px-3 py-1 rounded text-sm font-medium transition-colors disabled:opacity-50"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notifications List */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading && notifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-600 mb-2">All caught up!</h3>
            <p className="text-gray-500 text-sm">No notifications right now</p>
          </div>
        ) : (
          <div className="p-2">
            {notifications.map((notification, index) => (
              <div
                key={notification.id}
                className={`p-4 rounded-lg mb-2 transition-colors cursor-pointer border ${
                  !notification.isRead
                    ? 'bg-indigo-50 border-indigo-200 hover:bg-indigo-100'
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                }`}
                onClick={() => handleMarkAsRead(notification.id)}
              >
                <div className="flex items-start space-x-3">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${
                    !notification.isRead ? 'bg-white shadow-sm' : 'bg-white/70'
                  }`}>
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className={`font-semibold text-sm ${
                          !notification.isRead ? 'text-gray-900' : 'text-gray-700'
                        }`}>
                          {notification.title}
                        </h4>
                        <p className={`text-sm mt-1 ${
                          !notification.isRead ? 'text-gray-600' : 'text-gray-500'
                        }`}>
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className={`text-xs ${
                            !notification.isRead ? 'text-gray-500' : 'text-gray-400'
                          }`}>
                            {getTimeAgo(new Date(notification.createdAt))}
                          </span>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-indigo-600 rounded-full"></div>
                          )}
                        </div>
                      </div>
                      
                      {/* Delete Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNotification(notification.id);
                        }}
                        className="text-gray-400 hover:text-red-500 p-1 hover:bg-red-50 rounded transition-colors ml-2"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <button className="w-full text-center text-indigo-600 hover:text-indigo-800 font-medium text-sm transition-colors">
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}