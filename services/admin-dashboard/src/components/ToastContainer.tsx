import { AlertTriangle, Info, CheckCircle, X } from "lucide-react";
import { useNotifications } from "../context/NotificationContext";

export default function ToastContainer() {
  const { toasts, dismissToast } = useNotifications();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium animate-fade-in max-w-sm
            bg-white border-slate-200 text-slate-800"
        >
          {t.type === "alert" && <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
          {t.type === "info"  && <Info          className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />}
          {t.type === "success" && <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismissToast(t.id)}
            className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
