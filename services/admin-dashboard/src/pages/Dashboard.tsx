import { useEffect, useState, useCallback } from "react";
import { productsApi, ordersApi, stockApi, healthApi } from "../lib/api";
import { Package, ShoppingCart, AlertTriangle, Activity, TrendingUp, TrendingDown, ArrowUpRight, RefreshCw, CheckCircle, XCircle, Clock, Truck, BarChart2 } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import Spinner from "../components/Spinner";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

interface Stats {
  totalProducts: number;
  totalOrders: number;
  pendingOrders: number;
  alertCount: number;
}

interface ServiceHealth { auth: string; inventory: string; orders: string; reporting?: string; }
interface Order { id: string; status: string; total: number; createdAt: string; userId: string; }

const statusIcons: Record<string, React.ReactNode> = {
  CONFIRMED: <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />,
  FAILED:    <XCircle className="w-3.5 h-3.5 text-red-500" />,
  PENDING:   <Clock className="w-3.5 h-3.5 text-amber-500" />,
  CANCELLED: <XCircle className="w-3.5 h-3.5 text-slate-400" />,
  SHIPPED:   <Truck className="w-3.5 h-3.5 text-blue-500" />,
};

export default function Dashboard() {
  const { isManager, user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [health, setHealth] = useState<ServiceHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [productsRes, ordersRes, pendingRes, healthRes] = await Promise.allSettled([
        productsApi.list({ limit: 1 }),
        ordersApi.list({ limit: 8 }),
        ordersApi.list({ status: "PENDING", limit: 1 }),
        healthApi.check(),
      ]);

      let alertCount = 0;
      if (isManager) {
        try { const r = await stockApi.alerts(); alertCount = r.data.length; } catch {}
      }

      setStats({
        totalProducts: productsRes.status === "fulfilled" ? productsRes.value.data.total : 0,
        totalOrders:   ordersRes.status === "fulfilled" ? ordersRes.value.data.total : 0,
        pendingOrders: pendingRes.status === "fulfilled" ? pendingRes.value.data.total : 0,
        alertCount,
      });
      if (ordersRes.status === "fulfilled") setRecentOrders(ordersRes.value.data.data);
      if (healthRes.status === "fulfilled") setHealth(healthRes.value.data.services);
    } finally {
      setLoading(false);
    }
  }, [isManager]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <Spinner className="w-8 h-8 mx-auto" />
          <p className="text-sm text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Products",
      value: stats?.totalProducts ?? 0,
      icon: Package,
      color: "bg-blue-50 text-blue-600",
      border: "border-blue-100",
      trend: "+12%",
      trendUp: true,
    },
    {
      label: "Total Orders",
      value: stats?.totalOrders ?? 0,
      icon: ShoppingCart,
      color: "bg-violet-50 text-violet-600",
      border: "border-violet-100",
      trend: "+8%",
      trendUp: true,
    },
    {
      label: "Pending Orders",
      value: stats?.pendingOrders ?? 0,
      icon: Activity,
      color: "bg-amber-50 text-amber-600",
      border: "border-amber-100",
      trend: "-3%",
      trendUp: false,
    },
    {
      label: "Stock Alerts",
      value: stats?.alertCount ?? 0,
      icon: AlertTriangle,
      color: "bg-red-50 text-red-600",
      border: "border-red-100",
      trend: stats?.alertCount ? "Action needed" : "All clear",
      trendUp: !stats?.alertCount,
    },
  ];

  const confirmedOrders = recentOrders.filter(o => o.status === "CONFIRMED").length;
  const totalRevenue = recentOrders.reduce((sum, o) => sum + Number(o.total), 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Here's what's happening with your inventory today.</p>
        </div>
        <button onClick={load} className="btn-secondary text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, border, trend, trendUp }) => (
          <div key={label} className={`card p-5 border ${border} hover:shadow-card-hover transition-all duration-200`}>
            <div className="flex items-start justify-between">
              <div className={`w-11 h-11 rounded-xl ${color} flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"}`}>
                {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {trend}
              </span>
            </div>
            <div className="mt-4">
              <p className="text-3xl font-bold text-slate-900">{value.toLocaleString()}</p>
              <p className="text-sm text-slate-500 mt-1">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-5 bg-gradient-to-br from-blue-600 to-blue-700 border-0 text-white">
          <p className="text-blue-200 text-sm font-medium">Recent Revenue</p>
          <p className="text-3xl font-bold mt-2">${totalRevenue.toFixed(2)}</p>
          <p className="text-blue-200 text-xs mt-1">From last {recentOrders.length} orders</p>
        </div>
        <div className="card p-5">
          <p className="text-slate-500 text-sm font-medium">Success Rate</p>
          <p className="text-3xl font-bold text-slate-900 mt-2">
            {recentOrders.length > 0 ? Math.round((confirmedOrders / recentOrders.length) * 100) : 0}%
          </p>
          <p className="text-slate-400 text-xs mt-1">{confirmedOrders} of {recentOrders.length} confirmed</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-slate-500 text-sm font-medium">Service Health</p>
            <Link to="/reports" className="btn-ghost text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 py-1 px-2">
              <BarChart2 className="w-3 h-3" /> Analytics
            </Link>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {health ? (
              Object.entries(health).map(([svc, status]) => (
                <div key={svc} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${status === "up" ? "bg-emerald-500 animate-pulse-slow" : "bg-red-500"}`} />
                  <span className="text-xs text-slate-600 capitalize">{svc}</span>
                </div>
              ))
            ) : (
              <span className="text-sm text-slate-400">Checking...</span>
            )}
          </div>
          <p className="text-slate-400 text-xs mt-2">
            {health && Object.values(health).every(s => s === "up") ? "All systems operational" : "Some services degraded"}
          </p>
        </div>
      </div>

      {/* Recent orders */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-slate-900">Recent Orders</h2>
            <p className="text-xs text-slate-500 mt-0.5">Latest {recentOrders.length} orders across all users</p>
          </div>
          <Link to="/orders" className="btn-ghost text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50">
            View all <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-medium">No orders yet</p>
            <p className="text-sm mt-1">Orders will appear here once placed</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header first:rounded-none">Order ID</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Amount</th>
                  <th className="table-header">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        {statusIcons[order.status]}
                        <span className="font-mono text-xs text-slate-600">{order.id.slice(0, 12)}...</span>
                      </div>
                    </td>
                    <td className="table-cell"><StatusBadge status={order.status} /></td>
                    <td className="table-cell text-right font-semibold text-slate-900">${Number(order.total).toFixed(2)}</td>
                    <td className="table-cell text-slate-400 text-xs">{new Date(order.createdAt).toLocaleString()}</td>
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
