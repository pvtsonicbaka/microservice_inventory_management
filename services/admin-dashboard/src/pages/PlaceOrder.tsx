import { useEffect, useState, useCallback } from "react";
import { productsApi, ordersApi } from "../lib/api";
import { ShoppingCart, Plus, Minus, Trash2, Package, Search, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import Spinner from "../components/Spinner";
import { useNavigate } from "react-router-dom";

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  category?: string;
  description?: string;
}

interface CartItem {
  product: Product;
  quantity: number;
}

type OrderState = "idle" | "placing" | "success" | "failed";

export default function PlaceOrder() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderState, setOrderState] = useState<OrderState>("idle");
  const [orderId, setOrderId] = useState("");
  const [orderError, setOrderError] = useState("");

  const LIMIT = 12;

  const load = useCallback(async (p = 1, q = search, cat = category) => {
    setLoading(true);
    try {
      const { data } = await productsApi.list({ page: p, limit: LIMIT, category: cat || undefined });
      setProducts(data.data);
      setTotal(data.total);
      setPage(p);
      const cats = Array.from(new Set(data.data.map((p: Product) => p.category).filter(Boolean))) as string[];
      if (cats.length > 0) setCategories((prev) => Array.from(new Set([...prev, ...cats])));
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => { load(1, search, category); }, [search, category]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQty = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.product.id === productId ? { ...i, quantity: i.quantity + delta } : i)
        .filter((i) => i.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const cartTotal = cart.reduce((sum, i) => sum + Number(i.product.price) * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setOrderState("placing");
    setOrderError("");
    try {
      const { data } = await ordersApi.create(
        cart.map((i) => ({ productId: i.product.id, quantity: i.quantity }))
      );
      setOrderId(data.id);
      setOrderState("success");
      setCart([]);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Order failed";
      setOrderError(typeof msg === "string" ? msg : "Failed to place order");
      setOrderState("failed");
    }
  };

  const inCart = (productId: string) => cart.find((i) => i.product.id === productId);

  if (orderState === "success") {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="card p-10 text-center max-w-md w-full animate-fade-in">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Order Placed!</h2>
          <p className="text-slate-500 mt-2">Your order is being processed. Stock will be reserved shortly.</p>
          <div className="mt-4 p-3 bg-slate-50 rounded-xl">
            <p className="text-xs text-slate-500">Order ID</p>
            <p className="font-mono text-sm text-slate-800 mt-1">{orderId}</p>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => navigate("/orders")} className="btn-primary flex-1 justify-center">
              View My Orders
            </button>
            <button onClick={() => setOrderState("idle")} className="btn-secondary flex-1 justify-center">
              Place Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Place Order</h1>
          <p className="text-slate-500 mt-1 text-sm">Browse products and add them to your cart</p>
        </div>
        {cart.length > 0 && (
          <div className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">
            <ShoppingCart className="w-4 h-4" />
            {cartCount} item{cartCount !== 1 ? "s" : ""} · ${cartTotal.toFixed(2)}
          </div>
        )}
      </div>

      <div className="flex gap-6">
        {/* Product grid */}
        <div className="flex-1 min-w-0">
          {/* Filters */}
          <div className="flex gap-3 mb-4">
            <form onSubmit={handleSearch} className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search products..."
                className="input pl-9 text-sm"
              />
            </form>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input text-sm w-44"
            >
              <option value="">All categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="flex justify-center py-16"><Spinner /></div>
          ) : products.length === 0 ? (
            <div className="card flex flex-col items-center py-16 text-slate-400">
              <Package className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">No products found</p>
              <p className="text-sm mt-1">Try a different search or category</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {products.map((p) => {
                  const cartItem = inCart(p.id);
                  return (
                    <div key={p.id} className={`card p-4 flex flex-col transition-all duration-200 hover:shadow-md`}>
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                          <Package className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-right">
                          {p.category && (
                            <span className="text-xs px-2 py-0.5 bg-slate-100 text-slate-600 rounded-lg">{p.category}</span>
                          )}
                        </div>
                      </div>
                      <h3 className="font-semibold text-slate-900 text-sm leading-snug">{p.name}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">{p.sku}</p>
                      {p.description && (
                        <p className="text-xs text-slate-500 mt-2 line-clamp-2 flex-1">{p.description}</p>
                      )}
                      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-lg font-bold text-slate-900">${Number(p.price).toFixed(2)}</span>
                        {cartItem ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQty(p.id, -1)}
                              className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-slate-900">{cartItem.quantity}</span>
                            <button
                              onClick={() => updateQty(p.id, 1)}
                              className="w-7 h-7 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(p)}
                            className="btn-primary py-1.5 px-3 text-xs"
                          >
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Pagination */}
              {total > LIMIT && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  <button onClick={() => load(page - 1)} disabled={page === 1} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40">
                    Previous
                  </button>
                  <span className="text-sm text-slate-500">Page {page} of {Math.ceil(total / LIMIT)}</span>
                  <button onClick={() => load(page + 1)} disabled={page >= Math.ceil(total / LIMIT)} className="btn-secondary px-3 py-1.5 text-sm disabled:opacity-40">
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Cart sidebar */}
        <div className="w-80 shrink-0">
          <div className="card p-5 sticky top-6">
            <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
              <ShoppingCart className="w-4 h-4 text-blue-500" />
              Cart
              {cart.length > 0 && (
                <span className="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">{cartCount}</span>
              )}
            </h2>

            {cart.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Your cart is empty</p>
                <p className="text-xs mt-1">Add products from the left</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{item.product.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">${Number(item.product.price).toFixed(2)} × {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-sm font-bold text-slate-900">${(Number(item.product.price) * item.quantity).toFixed(2)}</span>
                        <button onClick={() => removeFromCart(item.product.id)} className="ml-1 text-slate-400 hover:text-red-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500">Subtotal ({cartCount} items)</span>
                    <span className="font-bold text-slate-900">${cartTotal.toFixed(2)}</span>
                  </div>

                  {orderError && (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-600">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {orderError}
                    </div>
                  )}

                  <button
                    onClick={placeOrder}
                    disabled={orderState === "placing"}
                    className="btn-primary w-full justify-center py-3"
                  >
                    {orderState === "placing" ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Placing order...</>
                    ) : (
                      <><ShoppingCart className="w-4 h-4" /> Place Order</>
                    )}
                  </button>
                  <button onClick={() => setCart([])} className="btn-ghost w-full justify-center text-sm text-slate-500">
                    Clear cart
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
