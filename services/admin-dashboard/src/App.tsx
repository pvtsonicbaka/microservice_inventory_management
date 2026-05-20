import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { NotificationProvider } from "./context/NotificationContext";
import ToastContainer from "./components/ToastContainer";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Warehouses from "./pages/Warehouses";
import Orders from "./pages/Orders";
import StockAlerts from "./pages/StockAlerts";
import Analytics from "./pages/Analytics";
import Search from "./pages/Search";
import Users from "./pages/Users";
import PlaceOrder from "./pages/PlaceOrder";
import Spinner from "./components/Spinner";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route
        path="/"
        element={<ProtectedRoute><Layout /></ProtectedRoute>}
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="warehouses" element={<Warehouses />} />
        <Route path="orders" element={<Orders />} />
        <Route path="alerts" element={<StockAlerts />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="search" element={<Search />} />
        <Route path="users" element={<Users />} />
        <Route path="place-order" element={<PlaceOrder />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppRoutes />
          <ToastContainer />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
