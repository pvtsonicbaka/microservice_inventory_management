import { useRef, useState, useEffect } from "react";
import { Bell, AlertTriangle, CheckCheck, RefreshCw, X } from "lucide-react";
import { useNotifications } from "../context/NotificationContext";
import { useNavigate } from "react-router-dom";

export default function NotificationBell() {
  const { alerts, unreadCount, markAllRead, refresh } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open) markAllRead();
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate("/alerts");
  };

  return (
    <div className="relative" ref={ref}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative p-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-600" />
              <span className="font-semibold text-slate-900 text-sm">Notifications</span>
              {alerts.length > 0 && (
                <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold">
                  {alerts.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={refresh}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Alert list */}
          <div className="max-h-72 overflow-y-auto">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-slate-400">
                <CheckCheck className="w-8 h-8 mb-2 text-emerald-400" />
                <p className="text-sm font-medium text-slate-600">All clear!</p>
                <p className="text-xs mt-0.5">No low-stock alerts right now</p>
              </div>
            ) : (
              alerts.map((a, i) => (
                <div
                  key={`${a.productId}-${i}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0 cursor-pointer"
                  onClick={handleViewAll}
                >
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{a.productName}</p>
                    <p className="text-xs text-red-600 mt-0.5">Stock ≤ {a.threshold} units</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(a.triggeredAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
              <button
                onClick={handleViewAll}
                className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
              >
                View all alerts →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
