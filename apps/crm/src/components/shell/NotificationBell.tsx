'use client';

import { useState, useEffect } from 'react';
import { getUnreadNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/server/actions/notifications';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifs = async () => {
      const res = await getUnreadNotifications();
      if (res.ok) {
        setItems(res.data);
        setUnreadCount(res.data.length);
      }
    };
    
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 60000); // polling (FR-C23)
    return () => clearInterval(interval);
  }, []);

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await markNotificationAsRead(id);
    setItems(prev => prev.filter(n => n.id !== id));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsAsRead();
    setItems([]);
    setUnreadCount(0);
    setIsOpen(false);
  };

  const getHref = (n: any) => {
    switch(n.entityType) {
      case 'lead': return `/leads/${n.entityId}`;
      case 'visit': return `/visits`;
      default: return `/dashboard`; 
    }
  };

  return (
    <div className="relative z-40">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-9 h-9 rounded-full bg-background border shadow-sm hover:bg-accent transition-colors"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold leading-none text-white bg-destructive rounded-full border-2 border-background">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-background border rounded-lg shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
          <div className="p-3 border-b flex justify-between items-center bg-card">
            <h3 className="font-semibold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-primary hover:underline font-medium">
                Mark all read
              </button>
            )}
          </div>
          
          <div className="overflow-y-auto flex-1">
            {items.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">You&rsquo;re all caught up!</div>
            ) : (
              <div className="divide-y">
                {items.map(n => (
                  <Link 
                    key={n.id} 
                    href={getHref(n)}
                    onClick={() => markNotificationAsRead(n.id)}
                    className="block p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-medium">{n.title}</span>
                      <button 
                        onClick={(e) => handleMarkRead(n.id, e)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{n.body}</p>
                    <span className="text-[10px] text-muted-foreground/70 font-medium uppercase tracking-wider">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
