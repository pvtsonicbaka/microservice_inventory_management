import { useEffect, useState, FormEvent } from "react";
import { warehousesApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Plus, Trash2, MapPin } from "lucide-react";
import Modal from "../components/Modal";
import Spinner from "../components/Spinner";

interface Warehouse {
  id: string;
  name: string;
  location: string;
  createdAt: string;
}

export default function Warehouses() {
  const { isAdmin } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", location: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await warehousesApi.list();
      setWarehouses(data);
    } catch {
      setError("Failed to load warehouses");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await warehousesApi.create(form);
      setShowForm(false);
      setForm({ name: "", location: "" });
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Create failed";
      setFormError(typeof msg === "string" ? msg : "Error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this warehouse? This will also remove all stock records.")) return;
    try {
      await warehousesApi.delete(id);
      load();
    } catch {
      alert("Delete failed");
    }
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Warehouses</h1>
          <p className="text-sm text-slate-500 mt-1">{warehouses.length} warehouse{warehouses.length !== 1 ? "s" : ""}</p>
        </div>
        {isAdmin && (
          <button onClick={() => { setForm({ name: "", location: "" }); setFormError(""); setShowForm(true); }} className="btn-primary">
            <Plus className="w-4 h-4" aria-hidden="true" /> Add Warehouse
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : error ? (
        <p className="text-center py-16 text-red-500">{error}</p>
      ) : warehouses.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-slate-400">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
            <MapPin className="w-8 h-8 text-blue-400" aria-hidden="true" />
          </div>
          <p className="font-semibold text-slate-700">No warehouses yet</p>
          {isAdmin && <p className="text-sm mt-1">Add your first warehouse to get started</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {warehouses.map((w) => (
            <div key={w.id} className="card p-5 hover:shadow-md transition-all duration-200">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-blue-600" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{w.name}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{w.location}</p>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(w.id)}
                    className="btn-danger px-2 py-1.5 text-xs ml-2 shrink-0"
                    aria-label={`Delete warehouse ${w.name}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-400">
                  Added {new Date(w.createdAt).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <Modal title="Add Warehouse" onClose={() => setShowForm(false)}>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label" htmlFor="wh-name">Name *</label>
              <input id="wh-name" className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mumbai Central" />
            </div>
            <div>
              <label className="label" htmlFor="wh-loc">Location *</label>
              <input id="wh-loc" className="input" required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Mumbai, India" />
            </div>
            {formError && <p role="alert" className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{formError}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? <Spinner className="w-4 h-4" /> : null}
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
