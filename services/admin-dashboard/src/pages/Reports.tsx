import { useEffect, useState, useCallback } from "react";
import { reportingApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { TrendingUp, DollarSign, ShoppingCart, AlertTriangle, RefreshCw, BarChart2 } from "lucide-react";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";

interface DashboardData {
  totalOrders: number | { value: number };
  totalRevenue: number;
  avgOrderValue: number;
  ordersByStatus: { key: string; doc_count: number }[];
  ordersOverTime: { key_as_string: string; doc_count: number; daily_revenue?: { value: number } }[];
  productsByCategory: { key: string; doc_count: number }[];
  recentAlerts: { id: string; productId: string; productName?: string; threshold: number; triggeredAt: string }[];
  warning?: string;
}

export default function Reports() {
  const { isManager } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await reportingApi.dashboard();
      setData(res.data);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 403) setError("You need manager or admin access to view analytics.");
      else setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalOrdersNum = typeof data?.totalOrders === "object"
    ? (data.totalOrders as { value: number }).value
    : (data?.totalOrders ?? 0);

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Spinner className="w-8 h-8" />
    </div>
  );

  if (error) return (
    <div className="p-6">
      <div className="card p-8 flex flex-col items-center text-slate-400">
        <BarChart2 className="w-12 h-12 mb-3 opacity-20" />
        <p className="font-medium text-slate-600">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics & Reports</h1>
          <p className="text-slate-500 mt-1 text-sm">
            {data?.warning ? (
              <span className="text-amber-600">⚠️ {data.warning}</span>
            ) : "Real-time insights from your inventory system"}
          </p>
        </div>
        <button onClick={load} className="btn-secondary text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Orders", value: totalOrdersNum.toLocaleString(), icon: ShoppingCart, color: "bg-blue-50 text-blue-600" },
          { label: "Total Revenue", value: `$${(data?.totalRevenue ?? 0).toFixed(2)}`, icon: DollarSign, color: "bg-emerald-50 text-emerald-600" },
          { label: "Avg Order Value", value: `$${(data?.avgOrderValue ?? 0).toFixed(2)}`, icon: TrendingUp, color: "bg-violet-50 text-violet-600" },
          { label: "Stock Alerts", value: (data?.recentAlerts?.length ?? 0).toString(), icon: AlertTriangle, color: "bg-red-50 text-red-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders by status */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">Orders by Status</h2>
          </div>
          {(data?.ordersByStatus?.length ?? 0) === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">No order data yet</p>
          ) : (
            <div className="p-4 space-y-3">
              {data?.ordersByStatus.map((s) => {
                const total = data.ordersByStatus.reduce((sum, x) => sum + x.doc_count, 0);
                const pct = total > 0 ? Math.round((s.doc_count / total) * 100) : 0;
                return (
                  <div key={s.key} className="flex items-center gap-3">
                    <StatusBadge status={s.key} />
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-blue-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 w-8 text-right">{s.doc_count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Products by category */}
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">Products by Category</h2>
          </div>
          {(data?.productsByCategory?.length ?? 0) === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">No product data yet</p>
          ) : (
            <div className="p-4 space-y-3">
              {data?.productsByCategory.map((c) => {
                const total = data.productsByCategory.reduce((sum, x) => sum + x.doc_count, 0);
                const pct = total > 0 ? Math.round((c.doc_count / total) * 100) : 0;
                return (
                  <div key={c.key} className="flex items-center gap-3">
                    <span className="text-sm text-slate-600 w-28 truncate">{c.key || "Uncategorized"}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-violet-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-slate-700 w-8 text-right">{c.doc_count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Orders over time */}
      {(data?.ordersOverTime?.length ?? 0) > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">Orders Over Time (Last 30 Days)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-5 py-3 font-medium text-slate-500">Date</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-500">Orders</th>
                  <th className="text-right px-5 py-3 font-medium text-slate-500">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data?.ordersOverTime.filter(d => d.doc_count > 0).map((d) => (
                  <tr key={d.key_as_string} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-5 py-3 text-slate-600">{new Date(d.key_as_string).toLocaleDateString()}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900">{d.doc_count}</td>
                    <td className="px-5 py-3 text-right font-medium text-emerald-600">
                      ${(d.daily_revenue?.value ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent stock alerts */}
      {isManager && (data?.recentAlerts?.length ?? 0) > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100">
            <h2 className="font-bold text-slate-900">Recent Stock Alerts</h2>
          </div>
          <div className="divide-y divide-slate-50">
            {data?.recentAlerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium text-slate-700">{a.productName || a.productId.slice(0, 8) + "..."}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge bg-red-50 text-red-700">≤ {a.threshold} units</span>
                  <span className="text-xs text-slate-400">{new Date(a.triggeredAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
