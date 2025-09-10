"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";

type NotificationItem = {
  id: string;
  type: string;
  payload?: any;
  createdAt: string;
};

function titleFor(n: NotificationItem): string {
  switch (n.type) {
    case 'new_offer': return 'New offer on your request';
    case 'booking_reminder': return 'Booking reminder';
    case 'start_nudge': return 'Time to start';
    case 'finish_nudge': return 'Wrap up & finish';
    default: return 'Notification';
  }
}

export default function NotificationsToaster() {
  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let timer: any;
    const poll = async () => {
      try {
        const res = await fetch('/api/notifications?unread=true&limit=10', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const toMark: string[] = [];
          (data.notifications as NotificationItem[]).forEach((n) => {
            if (!seenRef.current.has(n.id)) {
              seenRef.current.add(n.id);
              toast(titleFor(n), {
                description: n.payload?.message || undefined,
              });
              toMark.push(n.id);
            }
          });
          if (toMark.length > 0) {
            // Mark as read after showing
            await fetch('/api/notifications', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: toMark }) });
          }
        }
      } catch (e) {
        // ignore
      } finally {
        timer = setTimeout(poll, 15000);
      }
    };
    poll();
    return () => timer && clearTimeout(timer);
  }, []);

  return null;
}

