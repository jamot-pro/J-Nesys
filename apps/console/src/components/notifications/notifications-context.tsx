"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAppShell, type SectionId } from "@/components/app-shell/app-shell-context";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type ApiNotification,
} from "@/lib/api-client";
import { listTasks } from "@/components/tasks/tasks-api";
import { listAccounts, listChats } from "@/components/whatsapp/wa-api";

export type NotificationType =
  | "approval"
  | "completed"
  | "warning"
  | "opportunity"
  | "proposal"
  | "message";

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  summary: string;
  read: boolean;
  createdAt?: string;
  targetSection?: SectionId;
  targetId?: string;
}

interface NotificationsState {
  items: NotificationItem[];
  unread: number;
  loading: boolean;
  markRead: (id: string) => void;
  markAllRead: () => void;
  refresh: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsState | null>(null);

const STORAGE_KEY = "jamot:notifications:read_ids";
const POLL_INTERVAL_MS = 15_000;

function getStoredReadIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveStoredReadIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {}
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { space } = useAppShell();
  const spaceId = space.spaceId ?? space.id ?? "personal";
  
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => getStoredReadIds());
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;
    try {
      const liveItems: NotificationItem[] = [];
      const currentReadIds = getStoredReadIds();

      // 1. Fetch real tasks from Tasks App
      try {
        const tasks = await listTasks(spaceId);
        const now = Date.now();
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);

        for (const task of tasks) {
          if (!task.dueDate) continue;
          const dueTime = new Date(task.dueDate).getTime();

          // Overdue task alert
          if (dueTime < now) {
            liveItems.push({
              id: `task-overdue-${task.id}`,
              type: "warning",
              title: `Overdue: ${task.title}`,
              summary: task.description || `Task was due on ${new Date(task.dueDate).toLocaleDateString()}`,
              read: currentReadIds.has(`task-overdue-${task.id}`),
              createdAt: task.dueDate,
              targetSection: "tasks",
              targetId: task.id,
            });
          }
          // Due today alert
          else if (dueTime >= startOfToday.getTime() && dueTime <= endOfToday.getTime()) {
            liveItems.push({
              id: `task-today-${task.id}`,
              type: "completed",
              title: `Due Today: ${task.title}`,
              summary: task.description || "Scheduled for completion today.",
              read: currentReadIds.has(`task-today-${task.id}`),
              createdAt: task.dueDate,
              targetSection: "tasks",
              targetId: task.id,
            });
          }
        }
      } catch {
        // Task API unreachable or offline
      }

      // 2. Fetch real WhatsApp / Channel events
      try {
        const accounts = await listAccounts(spaceId);
        for (const acc of accounts) {
          // Channel pairing alert
          if (acc.status === "pairing" || acc.connection === "close") {
            liveItems.push({
              id: `channel-pairing-${acc.id}`,
              type: "warning",
              title: `${acc.label} disconnected`,
              summary: "WhatsApp session requires QR code pairing or reconnect.",
              read: currentReadIds.has(`channel-pairing-${acc.id}`),
              targetSection: "whatsapp",
              targetId: acc.id,
            });
          }

          // Unread chats
          if (acc.status === "connected" || acc.connection === "open") {
            try {
              const chats = await listChats(acc.id);
              for (const chat of chats) {
                if (chat.unread > 0) {
                  liveItems.push({
                    id: `chat-unread-${acc.id}-${chat.jid}`,
                    type: "opportunity",
                    title: `Message from ${chat.name}`,
                    summary: chat.lastMessage || `${chat.unread} unread messages on ${acc.label}.`,
                    read: currentReadIds.has(`chat-unread-${acc.id}-${chat.jid}`),
                    createdAt: new Date(chat.timestamp * 1000).toISOString(),
                    targetSection: "whatsapp",
                    targetId: chat.jid,
                  });
                }
              }
            } catch {}
          }
        }
      } catch {
        // WhatsApp API offline
      }

      // 3. Fetch server notifications from backend (if any)
      try {
        const serverItems = await listNotifications(spaceId);
        for (const api of serverItems) {
          liveItems.push({
            id: api.id,
            type: (api.type as NotificationType) || "completed",
            title: api.title,
            summary: api.summary,
            read: api.read || currentReadIds.has(api.id),
            createdAt: api.createdAt,
          });
        }
      } catch {}

      if (mountedRef.current) {
        setItems(liveItems);
        setReadIds(currentReadIds);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [spaceId]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveStoredReadIds(next);
      return next;
    });

    setItems((current) =>
      current.map((item) =>
        item.id === id ? { ...item, read: true } : item,
      ),
    );

    void markNotificationRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      items.forEach((item) => next.add(item.id));
      saveStoredReadIds(next);
      return next;
    });

    setItems((current) => current.map((item) => ({ ...item, read: true })));
    void markAllNotificationsRead().catch(() => {});
  }, [items]);

  const value = useMemo<NotificationsState>(() => {
    const unread = items.filter((item) => !item.read && !readIds.has(item.id)).length;
    return { items, unread, loading, markRead, markAllRead, refresh };
  }, [items, readIds, loading, markRead, markAllRead, refresh]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsState {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationsProvider");
  }
  return context;
}