import { useEffect, useState } from "react";
import { stockApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { AlertTriangle, RefreshCw } from "lucide-react";
import Spinner from "../components/Spinner";

interface Alert {
  productId: string;
  productName: string;
  threshold: number;
  triggeredAt: string;
}

export default function StockAlerts() {
  const { isManager } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await stockApi.alerts();
      setAlerts(data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) {
        setError("You need manager or admin access to view stock alerts.");
      } else {
        setError("Failed to load alerts");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Alerts</h1>
          <p className="text-sm text-slate-500 mt-1">Products below low-stock threshold</p>
        </div>
        {isManager && (
          <button onClick={load} className="btn-secondary" aria-label="Refresh alerts">
            <RefreshCw className="w-4 h-4" aria-hidden="true" /> Refresh
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : error ? (
        <div className="card flex flex-col items-center py-16 text-slate-400">
          <AlertTriangle className="w-10 h-10 mb-3 text-amber-400" aria-hidden="true" />
          <p className="text-slate-600 font-medium">{error}</p>
        </div>
      ) : alerts.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-slate-400">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mb-4">
            <AlertTriangle className="w-8 h-8 text-emerald-500" aria-hidden="true" />
          </div>
          <p className="font-semibold text-slate-700">All clear</p>
          <p className="text-sm mt-1">All products are above their stock thresholds</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-500" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">{alerts.length} active alert{alerts.length !== 1 ? "s" : ""}</p>
              <p className="text-xs text-slate-500">Requires immediate attention</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Product</th>
                  <th className="table-header">Product ID</th>
                  <th className="table-header text-right">Threshold</th>
                  <th className="table-header">Triggered At</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a, i) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500" aria-hidden="true" />
                        </div>
                        <span className="font-semibold text-slate-900">{a.productName}</span>
                      </div>
                    </td>
                    <td className="table-cell font-mono text-xs text-slate-500">{a.productId.slice(0, 8)}…</td>
                    <td className="table-cell text-right">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-50 text-red-700">
                        ≤ {a.threshold} units
                      </span>
                    </td>
                    <td className="table-cell text-slate-400 text-xs">
                      {new Date(a.triggeredAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
