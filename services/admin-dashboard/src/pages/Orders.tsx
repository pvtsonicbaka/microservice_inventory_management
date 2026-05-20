import { useEffect, useState, useCallback } from "react";
import { ordersApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Eye, XCircle, RefreshCw, ShoppingCart } from "lucide-react";
import StatusBadge from "../components/StatusBadge";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";

interface OrderItem {
  productId: string;
  quantity: number;
  price: number;
}

interface SagaStep {
  step: string;
  status: string;
  timestamp: string;
}

interface Order {
  id: string;
  userId: string;
  status: string;
  total: number;
  createdAt: string;
  items: OrderItem[];
}

interface OrderDetail extends Order {
  sagaSteps?: SagaStep[];
}

const STATUS_OPTIONS = ["", "PENDING", "CONFIRMED", "FAILED", "CANCELLED", "SHIPPED"];
const LIMIT = 15;

export default function Orders() {
  const { isAdmin } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (p: number, status: string) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await ordersApi.list({ page: p, limit: LIMIT, status: status || undefined });
      setOrders(data.data);
      setTotal(data.total);
    } catch {
      setError("Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page, statusFilter); }, [page, statusFilter, load]);

  const handleStatusFilter = (s: string) => {
    setStatusFilter(s);
    setPage(1);
  };

  const openDetail = async (order: Order) => {
    setDetail(order);
    setDetailLoading(true);
    try {
      const { data } = await ordersApi.status(order.id);
      setDetail((prev) => prev ? { ...prev, sagaSteps: data.sagaSteps } : null);
    } catch {
      // saga steps unavailable
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm("Cancel this order?")) return;
    try {
      const { data: updated } = await ordersApi.cancel(id);
      // update the row in the table in-place
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status: updated.status } : o));
      // update the detail modal if it's open for this order
      if (detail?.id === id) {
        setDetail((prev) => prev ? { ...prev, status: updated.status } : null);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Cancel failed";
      alert(typeof msg === "string" ? msg : "Cannot cancel order");
    }
  };

  const canCancel = (status: string) => ["PENDING", "CONFIRMED"].includes(status);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Orders</h1>
          <p className="text-sm text-slate-500 mt-1">{total} orders total</p>
        </div>
        <button onClick={() => load(page, statusFilter)} className="btn-secondary" aria-label="Refresh orders">
          <RefreshCw className="w-4 h-4" aria-hidden="true" /> Refresh
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s || "all"}
            onClick={() => handleStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              statusFilter === s
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-center py-16 text-red-500">{error}</p>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <ShoppingCart className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-medium">No orders found</p>
            {statusFilter && <p className="text-sm mt-1">Try clearing the status filter</p>}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Order ID</th>
                    {isAdmin && <th className="table-header">User</th>}
                    <th className="table-header">Status</th>
                    <th className="table-header text-right">Total</th>
                    <th className="table-header">Date</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="table-row">
                      <td className="table-cell font-mono text-xs text-slate-600">{o.id.slice(0, 8)}…</td>
                      {isAdmin && <td className="table-cell font-mono text-xs text-slate-500">{o.userId.slice(0, 8)}…</td>}
                      <td className="table-cell"><StatusBadge status={o.status} /></td>
                      <td className="table-cell text-right font-semibold text-slate-900">${Number(o.total).toFixed(2)}</td>
                      <td className="table-cell text-slate-400 text-xs">{new Date(o.createdAt).toLocaleString()}</td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openDetail(o)}
                            className="btn-secondary px-2 py-1.5 text-xs"
                            aria-label={`View order ${o.id}`}
                          >
                            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                          </button>
                          {canCancel(o.status) && (
                            <button
                              onClick={() => handleCancel(o.id)}
                              className="btn-danger px-2 py-1.5 text-xs"
                              aria-label={`Cancel order ${o.id}`}
                            >
                              <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} limit={LIMIT} onChange={setPage} />
          </>
        )}
      </div>

      {/* Order detail modal */}
      {detail && (
        <Modal title={`Order ${detail.id.slice(0, 8)}…`} onClose={() => setDetail(null)}>
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
              <StatusBadge status={detail.status} />
              <span className="text-sm text-gray-500">{new Date(detail.createdAt).toLocaleString()}</span>
            </div>

            {/* Items */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Items</p>
              <div className="space-y-1">
                {detail.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm bg-gray-50 rounded px-3 py-2">
                    <span className="font-mono text-xs text-gray-600">{item.productId.slice(0, 8)}…</span>
                    <span className="text-gray-700">×{item.quantity}</span>
                    <span className="font-medium">${Number(item.price).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-sm font-semibold mt-2 px-3">
                <span>Total</span>
                <span>${Number(detail.total).toFixed(2)}</span>
              </div>
            </div>

            {/* Saga steps */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Saga Steps</p>
              {detailLoading ? (
                <div className="flex justify-center py-4"><Spinner className="w-5 h-5" /></div>
              ) : detail.sagaSteps && detail.sagaSteps.length > 0 ? (
                <ol className="space-y-2">
                  {detail.sagaSteps.map((step, i) => (
                    <li key={i} className="flex items-center gap-3 text-sm">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${step.status === "SUCCESS" ? "bg-green-500" : step.status === "FAILED" ? "bg-red-500" : "bg-yellow-400"}`} aria-hidden="true" />
                      <span className="font-mono text-xs text-gray-600 flex-1">{step.step}</span>
                      <StatusBadge status={step.status} />
                      <span className="text-xs text-gray-400">{new Date(step.timestamp).toLocaleTimeString()}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-gray-400">No saga steps recorded</p>
              )}
            </div>

            {/* Cancel button */}
            {canCancel(detail.status) && (
              <div className="flex justify-end pt-2 border-t border-gray-200">
                <button onClick={() => handleCancel(detail.id)} className="btn-danger">
                  <XCircle className="w-4 h-4" aria-hidden="true" /> Cancel Order
                </button>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
