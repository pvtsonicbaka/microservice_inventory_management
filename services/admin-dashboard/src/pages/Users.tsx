import { useEffect, useState, useCallback } from "react";
import { usersApi } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Users as UsersIcon, Shield, Eye, Briefcase, RefreshCw, ChevronDown } from "lucide-react";
import Spinner from "../components/Spinner";

interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "viewer";
  createdAt: string;
}

const ROLES = ["admin", "manager", "viewer"] as const;

const roleConfig = {
  admin:   { label: "Admin",   icon: Shield,   bg: "bg-purple-100 text-purple-700 border-purple-200" },
  manager: { label: "Manager", icon: Briefcase, bg: "bg-blue-100 text-blue-700 border-blue-200" },
  viewer:  { label: "Viewer",  icon: Eye,       bg: "bg-slate-100 text-slate-600 border-slate-200" },
};

export default function Users() {
  const { user: me, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await usersApi.list();
      setUsers(data);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3000);
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (userId === me?.id && newRole !== "admin") {
      if (!confirm("You are changing your own role. You may lose admin access. Continue?")) return;
    }
    setUpdating(userId);
    try {
      await usersApi.updateRole(userId, newRole);
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: newRole as User["role"] } : u));
      showToast(`Role updated to ${newRole}`);
    } catch {
      showToast("Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  const counts = {
    admin:   users.filter((u) => u.role === "admin").length,
    manager: users.filter((u) => u.role === "manager").length,
    viewer:  users.filter((u) => u.role === "viewer").length,
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500 mt-1 text-sm">{users.length} registered users</p>
        </div>
        <button onClick={load} className="btn-secondary text-sm">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {ROLES.map((role) => {
          const cfg = roleConfig[role];
          const Icon = cfg.icon;
          return (
            <div key={role} className="card p-5 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${cfg.bg}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{counts[role]}</p>
                <p className="text-sm text-slate-500">{cfg.label}s</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Users table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : error ? (
          <p className="text-center py-16 text-red-500">{error}</p>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-slate-400">
            <UsersIcon className="w-12 h-12 mb-3 opacity-20" />
            <p>No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">User</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Current Role</th>
                  <th className="table-header">Joined</th>
                  {isAdmin && <th className="table-header text-right">Change Role</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const cfg = roleConfig[u.role];
                  const Icon = cfg.icon;
                  const isMe = u.id === me?.id;
                  return (
                    <tr key={u.id} className={`table-row ${isMe ? "bg-blue-50/40" : ""}`}>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{u.name}</p>
                            {isMe && <span className="text-xs text-blue-500 font-medium">You</span>}
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-slate-500 text-sm">{u.email}</td>
                      <td className="table-cell">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${cfg.bg}`}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="table-cell text-slate-400 text-xs">
                        {new Date(u.createdAt).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      {isAdmin && (
                        <td className="table-cell text-right">
                          {updating === u.id ? (
                            <Spinner className="w-4 h-4 ml-auto" />
                          ) : (
                            <div className="relative inline-block">
                              <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                className="appearance-none pl-3 pr-8 py-1.5 text-xs font-medium border border-slate-200 rounded-lg bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-slate-300 transition-colors"
                              >
                                {ROLES.map((r) => (
                                  <option key={r} value={r}>{roleConfig[r].label}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-fade-in z-50">
          {toast}
        </div>
      )}
    </div>
  );
}
