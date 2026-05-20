import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, Package, ArrowRight, ShieldCheck } from "lucide-react";
import Spinner from "../components/Spinner";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Invalid email or password";
      setError(typeof msg === "string" ? msg : "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-900 via-navy-800 to-blue-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
        </div>

        {/* Logo */}
        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">InvenFlow</p>
            <p className="text-blue-300 text-xs">Inventory Management</p>
          </div>
        </div>

        {/* Main content */}
        <div className="relative space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Manage your inventory<br />
              <span className="text-blue-400">at scale.</span>
            </h1>
            <p className="mt-4 text-slate-300 text-lg leading-relaxed">
              Real-time stock tracking, order management, and analytics — all in one place.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {[
              "Real-time inventory tracking across warehouses",
              "Event-driven order processing with saga pattern",
              "Elasticsearch-powered product search",
              "Role-based access control",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-blue-500/20 border border-blue-400/30 flex items-center justify-center shrink-0">
                  <div className="w-2 h-2 rounded-full bg-blue-400" />
                </div>
                <span className="text-slate-300 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom */}
        <div className="relative flex items-center gap-2 text-slate-400 text-sm">
          <ShieldCheck className="w-4 h-4 text-blue-400" />
          <span>Enterprise-grade security & compliance</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">InvenFlow</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Welcome back</h2>
            <p className="text-slate-500 mt-2">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="label mb-0">Password</label>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="input pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email || !password}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {loading ? <Spinner className="w-4 h-4" /> : null}
              {loading ? "Signing in..." : (
                <>Sign in <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <Link to="/register" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
              Create account
            </Link>
          </p>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-xs text-center text-slate-400">
              Demo credentials: <span className="font-mono text-slate-600">admin@invenflow.com</span> / <span className="font-mono text-slate-600">Admin@123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
