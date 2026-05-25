import { useEffect, useState, FormEvent, useCallback } from "react";
import { productsApi, stockApi, warehousesApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Plus, Pencil, Trash2, BarChart2, Search, Sparkles, Package, TrendingUp } from "lucide-react";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";

interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string;
  price: number;
  category?: string;
  createdAt: string;
  totalStock?: number;
  availableStock?: number;
}

interface StockEntry {
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  reserved: number;
  available: number;
}

interface Warehouse {
  id: string;
  name: string;
  location: string;
}

const emptyForm = { name: "", sku: "", price: "", description: "", category: "", initialStock: "" };

export default function Products() {
  const { canWrite, isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [stockProduct, setStockProduct] = useState<Product | null>(null);
  const [stockData, setStockData] = useState<StockEntry[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockForm, setStockForm] = useState({ quantity: "", operation: "set" as "set" | "increment" | "decrement", warehouseId: "" });
  const [stockError, setStockError] = useState("");
  const [stockSaving, setStockSaving] = useState(false);

  const LIMIT = 15;

  const load = useCallback(async (p = 1, q = search) => {
    setLoading(true);
    setError("");
    try {
      const { data } = await productsApi.list({ page: p, limit: LIMIT, search: q || undefined });
      setProducts(data.data);
      setTotal(data.total);
    } catch {
      setError("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { load(page, search); }, [page, search]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleSeed = async () => {
    if (!confirm("Seed 12 demo products into the first available warehouse?")) return;
    setSeeding(true);
    setSeedMsg("");
    try {
      const { data } = await productsApi.seed();
      setSeedMsg(`✓ Seeded ${data.created?.length ?? 0} products${data.skipped?.length ? ` (${data.skipped.length} skipped)` : ""}`);
      load(1, search);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setSeedMsg(`✗ ${msg ?? "Seed failed — create a warehouse first"}`);
    } finally {
      setSeeding(false);
      setTimeout(() => setSeedMsg(""), 6000);
    }
  };

  const openCreate = () => {
    setEditProduct(null);
    setForm(emptyForm);
    setFormError("");
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({ name: p.name, sku: p.sku, price: String(p.price), description: p.description ?? "", category: p.category ?? "", initialStock: "" });
    setFormError("");
    setShowForm(true);
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        price: Number(form.price),
        description: form.description || undefined,
        category: form.category || undefined,
        ...(!editProduct && form.initialStock ? { initialStock: Number(form.initialStock) } : {}),
      };
      if (editProduct) {
        await productsApi.update(editProduct.id, payload);
      } else {
        await productsApi.create(payload);
      }
      setShowForm(false);
      load(page, search);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Save failed";
      setFormError(typeof msg === "string" ? msg : "Validation error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await productsApi.delete(id);
      load(page, search);
    } catch {
      alert("Delete failed");
    }
  };

  const openStock = async (p: Product) => {
    setStockProduct(p);
    setStockError("");
    setStockForm({ quantity: "", operation: "set", warehouseId: "" });
    const [stockRes, whRes] = await Promise.allSettled([
      stockApi.get(p.id),
      warehousesApi.list(),
    ]);
    const whs = whRes.status === "fulfilled" ? whRes.value.data : [];
    setWarehouses(whs);
    setStockData(stockRes.status === "fulfilled" ? stockRes.value.data : []);
    if (whs.length > 0) setStockForm((f) => ({ ...f, warehouseId: whs[0].id }));
  };

  const handleStockUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!stockProduct) return;
    setStockError("");
    setStockSaving(true);
    try {
      await stockApi.update(stockProduct.id, { quantity: Number(stockForm.quantity), operation: stockForm.operation, warehouseId: stockForm.warehouseId });
      const { data } = await stockApi.get(stockProduct.id);
      setStockData(data);
      setStockForm((f) => ({ ...f, quantity: "" }));
      // refresh table to show updated stock
      load(page, search);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Stock update failed";
      setStockError(typeof msg === "string" ? msg : "Error");
    } finally {
      setStockSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Products</h1>
          <p className="text-sm text-slate-500 mt-1">{total} products total</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {seedMsg && (
            <span className={`text-xs px-3 py-1.5 rounded-lg font-medium ${seedMsg.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
              {seedMsg}
            </span>
          )}
          {isAdmin && (
            <button onClick={handleSeed} disabled={seeding} className="btn-secondary text-sm">
              {seeding ? <Spinner className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-amber-500" />}
              Seed Demo Data
            </button>
          )}
          {canWrite && (
            <button onClick={openCreate} className="btn-primary">
              <Plus className="w-4 h-4" /> Add Product
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, SKU, description..."
            className="input pl-9 text-sm"
          />
        </div>
        <button type="submit" className="btn-secondary text-sm">Search</button>
        {search && (
          <button type="button" onClick={() => { setSearch(""); setSearchInput(""); setPage(1); }} className="btn-ghost text-sm text-slate-500">
            Clear
          </button>
        )}
      </form>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-center py-16 text-red-500">{error}</p>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <Package className="w-12 h-12 mb-3 opacity-20" />
            <p className="font-medium text-slate-600">{search ? "No products match your search" : "No products yet"}</p>
            {canWrite && !search && (
              <div className="flex gap-3 mt-4">
                <button onClick={openCreate} className="btn-primary text-sm">
                  <Plus className="w-4 h-4" /> Add Product
                </button>
                {isAdmin && (
                  <button onClick={handleSeed} className="btn-secondary text-sm">
                    <Sparkles className="w-4 h-4 text-amber-500" /> Seed Demo Data
                  </button>
                )}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Name</th>
                    <th className="table-header">SKU</th>
                    <th className="table-header">Category</th>
                    <th className="table-header text-right">Price</th>
                    <th className="table-header text-right">Stock</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const avail = p.availableStock ?? 0;
                    const stockColor = avail === 0 ? "text-red-600 bg-red-50" : avail <= 5 ? "text-amber-600 bg-amber-50" : "text-emerald-700 bg-emerald-50";
                    return (
                      <tr key={p.id} className="table-row">
                        <td className="table-cell">
                          <div>
                            <p className="font-semibold text-slate-900">{p.name}</p>
                            {p.description && <p className="text-xs text-slate-400 truncate max-w-xs">{p.description}</p>}
                          </div>
                        </td>
                        <td className="table-cell text-slate-500 font-mono text-xs">{p.sku}</td>
                        <td className="table-cell">
                          {p.category ? (
                            <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-medium">{p.category}</span>
                          ) : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="table-cell text-right font-semibold text-slate-900">${Number(p.price).toFixed(2)}</td>
                        <td className="table-cell text-right">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${stockColor}`}>
                            <TrendingUp className="w-3 h-3" />
                            {avail}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openStock(p)} className="btn-secondary px-2 py-1.5 text-xs" title="Manage stock" aria-label={`Manage stock for ${p.name}`}>
                              <BarChart2 className="w-3.5 h-3.5" />
                            </button>
                            {canWrite && (
                              <button onClick={() => openEdit(p)} className="btn-secondary px-2 py-1.5 text-xs" aria-label={`Edit ${p.name}`}>
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {isAdmin && (
                              <button onClick={() => handleDelete(p.id)} className="btn-danger px-2 py-1.5 text-xs" aria-label={`Delete ${p.name}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination page={page} total={total} limit={LIMIT} onChange={(p) => { setPage(p); load(p, search); }} />
          </>
        )}
      </div>

      {/* Create / Edit modal */}
      {showForm && (
        <Modal title={editProduct ? "Edit Product" : "Add Product"} onClose={() => setShowForm(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="p-name">Name *</label>
                <input id="p-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. MacBook Pro" />
              </div>
              <div>
                <label className="label" htmlFor="p-sku">SKU *</label>
                <input id="p-sku" className="input" required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="e.g. MBP-14-M3" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="p-price">Price ($) *</label>
                <input id="p-price" type="number" step="0.01" min="0.01" className="input" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <label className="label" htmlFor="p-category">Category</label>
                <input id="p-category" className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="e.g. Electronics" />
              </div>
            </div>
            {!editProduct && (
              <div>
                <label className="label" htmlFor="p-stock">Initial Stock (optional)</label>
                <input id="p-stock" type="number" min="0" step="1" className="input" value={form.initialStock} onChange={(e) => setForm({ ...form, initialStock: e.target.value })} placeholder="0 — set stock in first warehouse" />
                <p className="text-xs text-slate-400 mt-1">Will be set in the first available warehouse</p>
              </div>
            )}
            <div>
              <label className="label" htmlFor="p-desc">Description</label>
              <textarea id="p-desc" className="input resize-none" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional product description" />
            </div>
            {formError && <p role="alert" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Spinner className="w-4 h-4" /> : null}
                {saving ? "Saving…" : editProduct ? "Save Changes" : "Create Product"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Stock modal */}
      {stockProduct && (
        <Modal title={`Stock — ${stockProduct.name}`} onClose={() => setStockProduct(null)}>
          {stockData.length > 0 ? (
            <div className="mb-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Current Levels</p>
              <div className="space-y-2">
                {stockData.map((s) => (
                  <div key={s.warehouseId} className="bg-slate-50 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-slate-800 text-sm">{s.warehouseName}</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${s.available === 0 ? "bg-red-100 text-red-700" : s.available <= 5 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                        {s.available} available
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span>Total: <strong className="text-slate-800">{s.quantity}</strong></span>
                      <span>Reserved: <strong className="text-slate-800">{s.reserved}</strong></span>
                    </div>
                    {/* Stock bar */}
                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${s.available <= 5 ? "bg-amber-400" : "bg-emerald-500"}`}
                        style={{ width: s.quantity > 0 ? `${(s.available / s.quantity) * 100}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              No stock records yet. Use the form below to add initial stock.
            </div>
          )}

          {canWrite && warehouses.length > 0 && (
            <form onSubmit={handleStockUpdate} className="space-y-3 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Update Stock</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label text-xs" htmlFor="s-warehouse">Warehouse</label>
                  <select id="s-warehouse" className="input text-sm" value={stockForm.warehouseId} onChange={(e) => setStockForm({ ...stockForm, warehouseId: e.target.value })}>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs" htmlFor="s-op">Operation</label>
                  <select id="s-op" className="input text-sm" value={stockForm.operation} onChange={(e) => setStockForm({ ...stockForm, operation: e.target.value as "set" | "increment" | "decrement" })}>
                    <option value="set">Set to</option>
                    <option value="increment">Add</option>
                    <option value="decrement">Remove</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs" htmlFor="s-qty">Quantity</label>
                  <input id="s-qty" type="number" min="1" step="1" className="input text-sm" required value={stockForm.quantity} onChange={(e) => setStockForm({ ...stockForm, quantity: e.target.value })} />
                </div>
              </div>
              {stockError && <p role="alert" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{stockError}</p>}
              <div className="flex justify-end">
                <button type="submit" disabled={stockSaving} className="btn-primary">
                  {stockSaving ? <Spinner className="w-4 h-4" /> : null}
                  {stockSaving ? "Updating…" : "Update Stock"}
                </button>
              </div>
            </form>
          )}
          {canWrite && warehouses.length === 0 && (
            <p className="text-sm text-slate-500 mt-2">Create a warehouse first to manage stock.</p>
          )}
        </Modal>
      )}
    </div>
  );
}
