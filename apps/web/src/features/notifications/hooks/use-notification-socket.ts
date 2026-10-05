import { useEffect, useRef, useCallback, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { io, type Socket } from 'socket.io-client';

import { useAuth } from '@/contexts/use-auth';

import type { Notification } from '../api/notifications-api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useNotificationSocket() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const handleNewNotification = useCallback(
    (notification: Notification) => {
      // Update the notifications cache with the new notification
      queryClient.setQueryData<{
        items: Notification[];
        meta: { total: number };
        unreadCount: number;
      }>(['notifications', 1, 10], (oldData) => {
        if (!oldData) {
          return oldData;
        }
        return {
          ...oldData,
          items: [notification, ...oldData.items.slice(0, 9)],
          unreadCount: oldData.unreadCount + 1,
          meta: { ...oldData.meta, total: oldData.meta.total + 1 },
        };
      });

      // Update unread count
      queryClient.setQueryData<{ count: number }>(
        ['notifications', 'unread-count'],
        (oldData) => ({ count: (oldData?.count ?? 0) + 1 }),
      );
    },
    [queryClient],
  );

  const handleUnreadCount = useCallback(
    (data: { count: number }) => {
      queryClient.setQueryData(['notifications', 'unread-count'], data);
    },
    [queryClient],
  );

  useEffect(() => {
    // Don't connect if no authenticated user
    if (!user) {
      // Disconnect if was connected
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Already connected
    if (socketRef.current?.connected) {
      return;
    }

    // Create socket connection with credentials (sends cookies)
    const socket = io(`${API_URL}/notifications`, {
      withCredentials: true, // Send cookies for authentication
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      // Re-fetch unread count on connection to ensure we didn't miss any while disconnected
      void queryClient.invalidateQueries({
        queryKey: ['notifications', 'unread-count'],
      });
      // Also invalidate the main notifications list if it's already stale
      void queryClient.invalidateQueries({
        queryKey: ['notifications', 1, 10],
      });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleConnectError = () => {
      setIsConnected(false);
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('notification', handleNewNotification);
    socket.on('unread-count', handleUnreadCount);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('notification', handleNewNotification);
      socket.off('unread-count', handleUnreadCount);
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user, handleNewNotification, handleUnreadCount, queryClient]);

  return {
    isConnected,
  };
}
