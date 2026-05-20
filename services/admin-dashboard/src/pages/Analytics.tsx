import { useEffect, useState, useCallback } from "react";
import { reportingApi } from "../lib/api";
import {
  TrendingUp, DollarSign, ShoppingCart, Package,
  AlertTriangle, RefreshCw, BarChart2, PieChart,
  Activity, ArrowUpRight, Clock,
} from "lucide-react";
import Spinner from "../components/Spinner";
import StatusBadge from "../components/StatusBadge";

interface DashboardData {
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
  ordersByStatus: { key: string; doc_count: number }[];
  ordersOverTime: { key_as_string: string; doc_count: number; daily_revenue: { value: number } }[];
  topUsers: { key: string; doc_count: number; user_revenue: { value: number } }[];
  productsByCategory: { key: string; doc_count: number }[];
  priceStats: { min?: number; max?: number; avg?: number; count?: number };
  recentAlerts: { productId: string; productName: string; currentStock: number; threshold: number; triggeredAt: string }[];
  warning?: string;
}

// ── Mini bar chart (SVG) ──────────────────────────────────────
function BarChart({ data, valueKey, labelKey, color = "#3b82f6" }: {
  data: Record<string, unknown>[];
  valueKey: string;
  labelKey: string;
  color?: string;
}) {
  if (!data.length) return <p className="text-sm text-slate-400 py-4 text-center">No data yet</p>;
  const max = Math.max(...data.map((d) => Number(d[valueKey]) || 0), 1);
  return (
    <div className="flex items-end gap-1.5 h-32 w-full">
      {data.map((d, i) => {
        const val = Number(d[valueKey]) || 0;
        const pct = (val / max) * 100;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div
              className="w-full rounded-t-md transition-all duration-300 hover:opacity-80 cursor-pointer"
              style={{ height: `${Math.max(pct, 4)}%`, backgroundColor: color }}
            />
            {/* Tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
              {String(d[labelKey])}: {typeof val === "number" && val > 100 ? `$${val.toFixed(0)}` : val}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Donut chart (SVG) ─────────────────────────────────────────
const DONUT_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function DonutChart({ data, labelKey, valueKey }: {
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
}) {
  if (!data.length) return <p className="text-sm text-slate-400 py-4 text-center">No data yet</p>;

  const total = data.reduce((s, d) => s + (Number(d[valueKey]) || 0), 0);
  const size = 120;
  const r = 45;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const slices = data.map((d, i) => {
    const val = Number(d[valueKey]) || 0;
    const pct = total > 0 ? val / total : 0;
    const dash = pct * circumference;
    const gap = circumference - dash;
    const rotation = (offset / total) * 360 - 90;
    offset += val;
    return { d, pct, dash, gap, rotation, color: DONUT_COLORS[i % DONUT_COLORS.length] };
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {slices.map((s, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="18"
            strokeDasharray={`${s.dash} ${s.gap}`}
            strokeDashoffset={0}
            transform={`rotate(${s.rotation} ${cx} ${cy})`}
            className="transition-all duration-300"
          />
        ))}
        <circle cx={cx} cy={cy} r="28" fill="white" />
        <text x={cx} y={cy - 4} textAnchor="middle" className="text-xs font-bold" fill="#1e293b" fontSize="14" fontWeight="700">
          {total}
        </text>
        <text x={cx} y={cy + 12} textAnchor="middle" fill="#94a3b8" fontSize="8">
          total
        </text>
      </svg>
      <div className="space-y-2 flex-1 min-w-0">
        {slices.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-slate-600 truncate flex-1">{String(data[i][labelKey])}</span>
            <span className="font-semibold text-slate-800 shrink-0">{Number(data[i][valueKey])}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Line chart (SVG) ─────────────────────────────────────────
function LineChart({ data }: {
  data: { key_as_string: string; doc_count: number; daily_revenue: { value: number } }[];
}) {
  const last30 = data.slice(-30);
  if (!last30.length) return <p className="text-sm text-slate-400 py-4 text-center">No data yet</p>;

  const W = 400;
  const H = 100;
  const pad = { t: 8, r: 8, b: 20, l: 32 };
  const iW = W - pad.l - pad.r;
  const iH = H - pad.t - pad.b;

  const maxRev = Math.max(...last30.map((d) => d.daily_revenue.value), 1);
  const maxOrders = Math.max(...last30.map((d) => d.doc_count), 1);

  const revPoints = last30.map((d, i) => {
    const x = pad.l + (i / (last30.length - 1)) * iW;
    const y = pad.t + iH - (d.daily_revenue.value / maxRev) * iH;
    return `${x},${y}`;
  }).join(" ");

  const orderPoints = last30.map((d, i) => {
    const x = pad.l + (i / (last30.length - 1)) * iW;
    const y = pad.t + iH - (d.doc_count / maxOrders) * iH;
    return `${x},${y}`;
  }).join(" ");

  // Area fill for revenue
  const firstX = pad.l;
  const lastX = pad.l + iW;
  const baseY = pad.t + iH;
  const revArea = `${firstX},${baseY} ${revPoints} ${lastX},${baseY}`;

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280 }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <line
            key={t}
            x1={pad.l} y1={pad.t + iH * (1 - t)}
            x2={pad.l + iW} y2={pad.t + iH * (1 - t)}
            stroke="#f1f5f9" strokeWidth="1"
          />
        ))}
        {/* Revenue area */}
        <polygon points={revArea} fill="#3b82f6" fillOpacity="0.08" />
        {/* Revenue line */}
        <polyline points={revPoints} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Orders line */}
        <polyline points={orderPoints} fill="none" stroke="#10b981" strokeWidth="1.5" strokeDasharray="4 2" strokeLinejoin="round" strokeLinecap="round" />
        {/* Y-axis labels */}
        <text x={pad.l - 4} y={pad.t + 4} textAnchor="end" fill="#94a3b8" fontSize="7">${(maxRev / 1000).toFixed(0)}k</text>
        <text x={pad.l - 4} y={pad.t + iH} textAnchor="end" fill="#94a3b8" fontSize="7">$0</text>
        {/* X-axis labels — first and last */}
        {last30.length > 1 && (
          <>
            <text x={pad.l} y={H - 4} textAnchor="start" fill="#94a3b8" fontSize="7">
              {new Date(last30[0].key_as_string).toLocaleDateString("en", { month: "short", day: "numeric" })}
            </text>
            <text x={pad.l + iW} y={H - 4} textAnchor="end" fill="#94a3b8" fontSize="7">
              {new Date(last30[last30.length - 1].key_as_string).toLocaleDateString("en", { month: "short", day: "numeric" })}
            </text>
          </>
        )}
      </svg>
      <div className="flex items-center gap-4 mt-2 justify-center">
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-3 h-0.5 bg-blue-500 rounded" />Revenue
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <div className="w-3 h-0.5 bg-emerald-500 rounded border-dashed" style={{ borderTop: "1.5px dashed #10b981", background: "none" }} />Orders
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function Analytics() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data: d } = await reportingApi.dashboard();
      setData(d);
    } catch {
      setError("Failed to load analytics. Make sure the reporting service is running.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Spinner className="w-8 h-8 mx-auto" />
          <p className="text-sm text-slate-500">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <div className="card p-10 text-center max-w-md">
          <BarChart2 className="w-12 h-12 mx-auto text-slate-300 mb-4" />
          <p className="font-semibold text-slate-700">{error}</p>
          <button onClick={load} className="btn-primary mt-4 mx-auto">
            <RefreshCw className="w-4 h-4" /> Retry
          </button>
        </div>
      </div>
    );
  }

  const kpis = [
    {
      label: "Total Revenue",
      value: `$${(data?.totalRevenue ?? 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: "bg-blue-50 text-blue-600",
      border: "border-blue-100",
    },
    {
      label: "Total Orders",
      value: (data?.totalOrders ?? 0).toLocaleString(),
      icon: ShoppingCart,
      color: "bg-violet-50 text-violet-600",
      border: "border-violet-100",
    },
    {
      label: "Avg Order Value",
      value: `$${(data?.avgOrderValue ?? 0).toFixed(2)}`,
      icon: TrendingUp,
      color: "bg-emerald-50 text-emerald-600",
      border: "border-emerald-100",
    },
    {
      label: "Products Indexed",
      value: (data?.priceStats as { count?: number })?.count?.toLocaleString() ?? "—",
      icon: Package,
      color: "bg-amber-50 text-amber-600",
      border: "border-amber-100",
    },
  ];

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Analytics</h1>
          <p className="text-slate-500 mt-1 text-sm">Elasticsearch-powered insights across orders and inventory</p>
        </div>
        <button onClick={load} className="btn-secondary text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {data?.warning && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{data.warning} — showing cached or empty data.</span>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color, border }) => (
          <div key={label} className={`card p-5 border ${border}`}>
            <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center mb-4`}>
              <Icon className="w-5 h-5" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
            <p className="text-sm text-slate-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      {/* Revenue over time */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              Revenue & Orders Over Time
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Last 30 days</p>
          </div>
        </div>
        <LineChart data={data?.ordersOverTime ?? []} />
      </div>

      {/* Orders by status + Products by category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-violet-500" />
            Orders by Status
          </h2>
          <DonutChart
            data={data?.ordersByStatus ?? []}
            labelKey="key"
            valueKey="doc_count"
          />
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4 text-emerald-500" />
            Products by Category
          </h2>
          <BarChart
            data={data?.productsByCategory ?? []}
            valueKey="doc_count"
            labelKey="key"
            color="#10b981"
          />
          <div className="flex flex-wrap gap-2 mt-3">
            {(data?.productsByCategory ?? []).map((c, i) => (
              <span key={i} className="text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-600">
                {c.key} <span className="font-semibold text-slate-800">{c.doc_count}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Price stats + Top users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-blue-500" />
            Product Price Statistics
          </h2>
          {data?.priceStats && (data.priceStats as { count?: number }).count ? (
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Min Price", value: `$${((data.priceStats as { min?: number }).min ?? 0).toFixed(2)}` },
                { label: "Max Price", value: `$${((data.priceStats as { max?: number }).max ?? 0).toFixed(2)}` },
                { label: "Avg Price", value: `$${((data.priceStats as { avg?: number }).avg ?? 0).toFixed(2)}` },
                { label: "Total Products", value: ((data.priceStats as { count?: number }).count ?? 0).toLocaleString() },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-4">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-xl font-bold text-slate-900 mt-1">{value}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">No product data indexed yet</p>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
            <ArrowUpRight className="w-4 h-4 text-amber-500" />
            Top Customers by Revenue
          </h2>
          {(data?.topUsers ?? []).length > 0 ? (
            <div className="space-y-3">
              {(data?.topUsers ?? []).map((u, i) => {
                const maxRev = Math.max(...(data?.topUsers ?? []).map((x) => x.user_revenue.value), 1);
                const pct = (u.user_revenue.value / maxRev) * 100;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-slate-600">{u.key.slice(0, 12)}…</span>
                      <span className="font-semibold text-slate-800">${u.user_revenue.value.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">No order data indexed yet</p>
          )}
        </div>
      </div>

      {/* Recent stock alerts */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Recent Low-Stock Alerts
          </h2>
          <span className="text-xs text-slate-500">{data?.recentAlerts?.length ?? 0} recent</span>
        </div>
        {(data?.recentAlerts ?? []).length === 0 ? (
          <div className="flex flex-col items-center py-12 text-slate-400">
            <AlertTriangle className="w-10 h-10 mb-3 opacity-20" />
            <p className="text-sm">No recent alerts — all stock levels healthy</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Product</th>
                  <th className="table-header text-right">Current Stock</th>
                  <th className="table-header text-right">Threshold</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Triggered</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentAlerts ?? []).map((a, i) => (
                  <tr key={i} className="table-row">
                    <td className="table-cell font-medium text-slate-900">{a.productName}</td>
                    <td className="table-cell text-right">
                      <span className="font-bold text-red-600">{a.currentStock}</span>
                    </td>
                    <td className="table-cell text-right text-slate-500">≤ {a.threshold}</td>
                    <td className="table-cell">
                      <StatusBadge status={a.currentStock === 0 ? "FAILED" : "PENDING"} />
                    </td>
                    <td className="table-cell text-slate-400 text-xs flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(a.triggeredAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
