import { useState, FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, Package, ArrowRight, User, Mail, Lock } from "lucide-react";
import Spinner from "../components/Spinner";
import { authApi } from "../lib/api";

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await authApi.register(email, password, name);
      // auto-login after register
      await login(email, password);
      navigate("/");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Registration failed";
      setError(typeof msg === "string" ? msg : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-navy-900 via-navy-800 to-blue-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl" />
        </div>

        <div className="relative flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
            <Package className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">InvenFlow</p>
            <p className="text-blue-300 text-xs">Inventory Management</p>
          </div>
        </div>

        <div className="relative space-y-6">
          <div>
            <h1 className="text-4xl font-bold text-white leading-tight">
              Start managing<br />
              <span className="text-blue-400">smarter today.</span>
            </h1>
            <p className="mt-4 text-slate-300 text-lg">
              Join thousands of businesses using InvenFlow to streamline their operations.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Orders processed", value: "2M+" },
              { label: "Products tracked", value: "500K+" },
              { label: "Warehouses", value: "10K+" },
              { label: "Uptime", value: "99.9%" },
            ].map((stat) => (
              <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-slate-400 text-xs mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-slate-400 text-sm">
          New accounts start with <span className="text-blue-400 font-medium">viewer access</span>. Contact your admin to upgrade.
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg">InvenFlow</span>
          </div>

          <div className="mb-8">
            <h2 className="text-3xl font-bold text-slate-900">Create account</h2>
            <p className="text-slate-500 mt-2">Get started with InvenFlow for free</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="name" className="label">Full name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="input pl-11"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="label">Email address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input pl-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  className="input pl-11 pr-12"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password && password.length < 8 && (
                <p className="mt-1.5 text-xs text-amber-600">Password must be at least 8 characters</p>
              )}
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !name || !email || password.length < 8}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {loading ? <Spinner className="w-4 h-4" /> : null}
              {loading ? "Creating account..." : (
                <>Create account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
