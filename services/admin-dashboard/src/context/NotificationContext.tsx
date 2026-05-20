import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef,
} from "react";
import { stockApi } from "../lib/api";
import { useAuth } from "./AuthContext";

export interface StockAlert {
  productId: string;
  productName: string;
  threshold: number;
  triggeredAt: string;
}

export interface Toast {
  id: string;
  message: string;
  type: "alert" | "info" | "success";
}

interface NotificationContextValue {
  alerts: StockAlert[];
  unreadCount: number;
  toasts: Toast[];
  markAllRead: () => void;
  dismissToast: (id: string) => void;
  refresh: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const POLL_INTERVAL = 30_000; // 30 seconds

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { isManager, user } = useAuth();
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [lastSeenCount, setLastSeenCount] = useState<number>(() => {
    return Number(localStorage.getItem("lastSeenAlertCount") ?? 0);
  });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const prevAlertsRef = useRef<StockAlert[]>([]);

  const addToast = useCallback((message: string, type: Toast["type"] = "alert") => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev.slice(-3), { id, message, type }]); // max 4 toasts
    // auto-dismiss after 5s
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const fetchAlerts = useCallback(async () => {
    if (!isManager) return;
    try {
      const { data } = await stockApi.alerts();
      const incoming: StockAlert[] = data;

      // Find genuinely new alerts (not seen before by triggeredAt+productId)
      const prevKeys = new Set(prevAlertsRef.current.map((a) => `${a.productId}:${a.triggeredAt}`));
      const newAlerts = incoming.filter(
        (a) => !prevKeys.has(`${a.productId}:${a.triggeredAt}`)
      );

      if (newAlerts.length > 0 && prevAlertsRef.current.length > 0) {
        // Only toast if we already had data (not on first load)
        newAlerts.slice(0, 2).forEach((a) => {
          addToast(`⚠️ Low stock: ${a.productName} (≤${a.threshold} units)`, "alert");
        });
        if (newAlerts.length > 2) {
          addToast(`+${newAlerts.length - 2} more low-stock alerts`, "info");
        }
      }

      prevAlertsRef.current = incoming;
      setAlerts(incoming);
    } catch {
      // silently fail — don't spam errors
    }
  }, [isManager, addToast]);

  // Poll on mount and every 30s
  useEffect(() => {
    if (!user || !isManager) return;
    fetchAlerts();
    const interval = setInterval(fetchAlerts, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [user, isManager, fetchAlerts]);

  const unreadCount = Math.max(0, alerts.length - lastSeenCount);

  const markAllRead = useCallback(() => {
    setLastSeenCount(alerts.length);
    localStorage.setItem("lastSeenAlertCount", String(alerts.length));
  }, [alerts.length]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <NotificationContext.Provider value={{
      alerts, unreadCount, toasts, markAllRead, dismissToast, refresh: fetchAlerts,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
