import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart,
  AlertTriangle, LogOut, ChevronRight, Package2,
  Search, Settings, BarChart2, SearchIcon,
  Users, ShoppingBag,
} from "lucide-react";
import { useState, FormEvent } from "react";
import NotificationBell from "./NotificationBell";

const mainNavItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true, roles: ["admin", "manager", "viewer"] },
  { to: "/place-order", label: "Place Order", icon: ShoppingBag, end: false, roles: ["admin", "manager", "viewer"] },
  { to: "/products", label: "Products", icon: Package, end: false, roles: ["admin", "manager", "viewer"] },
  { to: "/warehouses", label: "Warehouses", icon: Warehouse, end: false, roles: ["admin", "manager", "viewer"] },
  { to: "/orders", label: "Orders", icon: ShoppingCart, end: false, roles: ["admin", "manager", "viewer"] },
  { to: "/alerts", label: "Stock Alerts", icon: AlertTriangle, end: false, roles: ["admin", "manager"] },
];

const reportingNavItems = [
  { to: "/analytics", label: "Analytics", icon: BarChart2, end: false, roles: ["admin", "manager", "viewer"] },
  { to: "/search", label: "Search", icon: SearchIcon, end: false, roles: ["admin", "manager", "viewer"] },
];

const adminNavItems = [
  { to: "/users", label: "Users", icon: Users, end: false, roles: ["admin"] },
];

const roleColors: Record<string, string> = {
  admin:   "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  viewer:  "bg-slate-100 text-slate-600",
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate("/search");
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${collapsed ? "w-20" : "w-64"} bg-navy-900 flex flex-col shrink-0 transition-all duration-300 ease-in-out shadow-sidebar`}
        style={{ background: "linear-gradient(180deg, #0f172a 0%, #1e1b4b 100%)" }}
      >
        {/* Logo */}
        <div className={`flex items-center ${collapsed ? "justify-center px-4" : "px-6"} py-5 border-b border-white/5`}>
          <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shrink-0 shadow-lg">
            <Package2 className="w-5 h-5 text-white" />
          </div>
          {!collapsed && (
            <div className="ml-3 min-w-0">
              <p className="font-bold text-white text-base leading-none">InvenFlow</p>
              <p className="text-blue-300/70 text-xs mt-0.5">Management System</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {!collapsed && (
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-3 mb-3">Main Menu</p>
          )}
          {mainNavItems.filter((item) => item.roles.includes(user?.role ?? "viewer")).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) => isActive ? "nav-item-active" : "nav-item-inactive"}
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
              {!collapsed && <span className="flex-1">{label}</span>}
              {!collapsed && <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </NavLink>
          ))}

          {/* Reporting section */}
          {!collapsed && (
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-3 mt-5 mb-3">Reporting</p>
          )}
          {collapsed && <div className="my-3 border-t border-white/10" />}
          {reportingNavItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={collapsed ? label : undefined}
              className={({ isActive }) => isActive ? "nav-item-active" : "nav-item-inactive"}
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
              {!collapsed && <span className="flex-1">{label}</span>}
              {!collapsed && <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </NavLink>
          ))}

          {/* Admin section */}
          {user?.role === "admin" && (
            <>
              {!collapsed && (
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-3 mt-5 mb-3">Admin</p>
              )}
              {collapsed && <div className="my-3 border-t border-white/10" />}
              {adminNavItems.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) => isActive ? "nav-item-active" : "nav-item-inactive"}
                >
                  <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="flex-1">{label}</span>}
                  {!collapsed && <ChevronRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        {/* Bottom section */}
        <div className="px-3 py-4 border-t border-white/5 space-y-2">
          {/* User card */}
          {!collapsed ? (
            <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5 border border-white/5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0 text-white font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                <span className={`text-xs px-1.5 py-0.5 rounded-md font-medium ${roleColors[user?.role ?? "viewer"]}`}>
                  {user?.role}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            title={collapsed ? "Log out" : undefined}
            className={`flex items-center ${collapsed ? "justify-center" : "gap-3"} w-full px-3 py-2.5 text-sm text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!collapsed && <span>Log out</span>}
          </button>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center py-3 border-t border-white/5 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${collapsed ? "" : "rotate-180"}`} />
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-slate-100 px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <form onSubmit={handleSearch} className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-400"
              />
            </form>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBell />
            <button className="p-2.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors" aria-label="Settings">
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <div className="flex items-center gap-2.5 pl-1">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <p className="text-sm font-semibold text-slate-800 leading-none">{user?.name}</p>
                <p className="text-xs text-slate-500 mt-0.5 capitalize">{user?.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
