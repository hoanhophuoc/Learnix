import { useState } from 'react';

import { Bell, Loader2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

import { useNotifications } from '../hooks/use-notifications';

function formatTimeAgo(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) {
    return 'Just now';
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 7) {
    return `${days}d ago`;
  }
  return date.toLocaleDateString();
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { notifications, isLoading, unreadCount, markAsRead, markAllAsRead } =
    useNotifications();

  const handleNotificationClick = (notification: {
    id: string;
    isRead: boolean;
    link?: string | null;
  }) => {
    if (!notification.isRead) {
      markAsRead(notification.id);
    }
    if (notification.link) {
      setIsOpen(false);
      void navigate(notification.link);
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="relative p-2.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse ring-2 ring-background" />
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 sm:w-96 p-0 rounded-xl overflow-hidden bg-card border-border"
      >
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h4 className="font-semibold text-sm">Notifications</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-primary hover:text-primary hover:bg-primary/10"
              onClick={() => markAllAsRead()}
            >
              Mark all as read
            </Button>
          )}
        </div>

        <div className="h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex h-full items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications?.items?.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-20" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications?.items.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'flex flex-col gap-1 p-4 text-left transition-colors border-b border-border last:border-0 hover:bg-muted/50 w-full',
                    !notification.isRead && 'bg-primary/5 hover:bg-primary/10',
                    notification.link && 'cursor-pointer',
                  )}
                >
                  <div className="flex items-start justify-between gap-2 w-full">
                    <span
                      className={cn(
                        'text-sm font-medium flex items-center gap-1.5',
                        !notification.isRead && 'text-primary',
                      )}
                    >
                      {notification.title}
                      {notification.link && (
                        <ExternalLink className="w-3 h-3 opacity-50" />
                      )}
                    </span>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                      {formatTimeAgo(notification.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {notification.message}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
