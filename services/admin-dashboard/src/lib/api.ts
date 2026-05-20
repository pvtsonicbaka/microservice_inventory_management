import axios from "axios";

const BASE = import.meta.env.VITE_API_URL || "/api";

export const api = axios.create({ baseURL: BASE });

// attach access token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken });
          localStorage.setItem("accessToken", data.accessToken);
          original.headers.Authorization = `Bearer ${data.accessToken}`;
          return api(original);
        } catch {
          localStorage.clear();
          window.location.href = "/login";
        }
      } else {
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(err);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  register: (email: string, password: string, name: string) =>
    api.post("/auth/register", { email, password, name }),
  logout: (refreshToken: string) =>
    api.post("/auth/logout", { refreshToken }),
};

// ── Users (admin) ─────────────────────────────────────────────
export const usersApi = {
  list: () => api.get("/auth/users"),
  updateRole: (id: string, role: string) => api.patch(`/auth/users/${id}/role`, { role }),
};

// ── Products ──────────────────────────────────────────────────
export const productsApi = {
  list: (params?: { page?: number; limit?: number; category?: string }) =>
    api.get("/products", { params }),
  get: (id: string) => api.get(`/products/${id}`),
  create: (data: { name: string; sku: string; price: number; description?: string; category?: string }) =>
    api.post("/products", data),
  update: (id: string, data: { name: string; sku: string; price: number; description?: string; category?: string }) =>
    api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
};

// ── Stock ─────────────────────────────────────────────────────
export const stockApi = {
  get: (productId: string) => api.get(`/products/${productId}/stock`),
  update: (productId: string, data: { quantity: number; operation: "increment" | "decrement" | "set"; warehouseId: string }) =>
    api.patch(`/products/${productId}/stock`, data),
  alerts: () => api.get("/stock/alerts"),
};

// ── Warehouses ────────────────────────────────────────────────
export const warehousesApi = {
  list: () => api.get("/warehouses"),
  create: (data: { name: string; location: string }) => api.post("/warehouses", data),
  delete: (id: string) => api.delete(`/warehouses/${id}`),
};

// ── Orders ────────────────────────────────────────────────────
export const ordersApi = {
  list: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get("/orders", { params }),
  get: (id: string) => api.get(`/orders/${id}`),
  status: (id: string) => api.get(`/orders/${id}/status`),
  cancel: (id: string) => api.post(`/orders/${id}/cancel`),
  create: (items: { productId: string; quantity: number }[]) =>
    api.post("/orders", { items }),
};

// ── Reporting ─────────────────────────────────────────────────
export const reportingApi = {
  dashboard: () => api.get("/reporting/reports/dashboard"),
  search: (params: {
    q?: string;
    category?: string;
    minPrice?: number;
    maxPrice?: number;
    page?: number;
    limit?: number;
  }) => api.get("/reporting/search/products", { params }),
  stockAlerts: (params?: { page?: number; limit?: number }) =>
    api.get("/reporting/reports/stock-alerts", { params }),
};

// ── Health ────────────────────────────────────────────────────
export const healthApi = {
  check: () => api.get("/health"),
};
