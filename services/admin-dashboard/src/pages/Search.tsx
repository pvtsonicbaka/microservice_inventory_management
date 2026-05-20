import { useState, FormEvent, useCallback } from "react";
import { reportingApi } from "../lib/api";
import { Search as SearchIcon, Package, SlidersHorizontal, X, AlertCircle } from "lucide-react";
import Spinner from "../components/Spinner";
import Pagination from "../components/Pagination";

interface Product {
  id: string;
  name: string;
  sku: string;
  description?: string;
  price: number;
  category?: string;
  createdAt: string;
}

interface Facets {
  categories: { key: string; doc_count: number }[];
  priceStats: { min?: number; max?: number; avg?: number };
}

const LIMIT = 20;

export default function Search() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [results, setResults] = useState<Product[]>([]);
  const [facets, setFacets] = useState<Facets>({ categories: [], priceStats: {} });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [warning, setWarning] = useState("");

  const doSearch = useCallback(async (p = 1) => {
    setLoading(true);
    setWarning("");
    try {
      const { data } = await reportingApi.search({
        q: query || undefined,
        category: category || undefined,
        minPrice: minPrice ? Number(minPrice) : undefined,
        maxPrice: maxPrice ? Number(maxPrice) : undefined,
        page: p,
        limit: LIMIT,
      });
      setResults(data.data ?? []);
      setTotal(data.total ?? 0);
      setFacets(data.facets ?? { categories: [], priceStats: {} });
      setPage(p);
      setSearched(true);
      if (data.warning) setWarning(data.warning);
    } catch {
      setWarning("Search service unavailable");
    } finally {
      setLoading(false);
    }
  }, [query, category, minPrice, maxPrice]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    doSearch(1);
  };

  const clearFilters = () => {
    setCategory("");
    setMinPrice("");
    setMaxPrice("");
  };

  const hasFilters = category || minPrice || maxPrice;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Product Search</h1>
        <p className="text-slate-500 mt-1 text-sm">Elasticsearch-powered full-text search with faceted filters</p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products by name, SKU, or description..."
              className="input pl-11 text-base"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary relative ${hasFilters ? "border-blue-300 text-blue-600" : ""}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {hasFilters && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-blue-600 text-white text-xs rounded-full flex items-center justify-center">
                {[category, minPrice, maxPrice].filter(Boolean).length}
              </span>
            )}
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? <Spinner className="w-4 h-4" /> : <SearchIcon className="w-4 h-4" />}
            Search
          </button>
        </div>

        {/* Filters panel */}
        {showFilters && (
          <div className="card p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">Filters</p>
              {hasFilters && (
                <button type="button" onClick={clearFilters} className="text-xs text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors">
                  <X className="w-3 h-3" /> Clear all
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="label text-xs">Category</label>
                {facets.categories.length > 0 ? (
                  <select
                    className="input text-sm"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="">All categories</option>
                    {facets.categories.map((c) => (
                      <option key={c.key} value={c.key}>{c.key} ({c.doc_count})</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="input text-sm"
                    placeholder="e.g. Electronics"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  />
                )}
              </div>
              <div>
                <label className="label text-xs">Min Price ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input text-sm"
                  placeholder="0.00"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="label text-xs">Max Price ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="input text-sm"
                  placeholder="No limit"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>
            {facets.priceStats.min !== undefined && (
              <p className="text-xs text-slate-400 mt-2">
                Price range in index: ${facets.priceStats.min?.toFixed(2)} – ${facets.priceStats.max?.toFixed(2)} (avg ${facets.priceStats.avg?.toFixed(2)})
              </p>
            )}
          </div>
        )}
      </form>

      {/* Warning */}
      {warning && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {warning} — Products will appear here once indexed via Kafka events.
        </div>
      )}

      {/* Results */}
      {!searched && !loading && (
        <div className="card flex flex-col items-center py-20 text-slate-400">
          <SearchIcon className="w-14 h-14 mb-4 opacity-20" />
          <p className="font-medium text-slate-500">Search for products</p>
          <p className="text-sm mt-1">Enter a query above to search the Elasticsearch index</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner className="w-8 h-8" />
        </div>
      )}

      {searched && !loading && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              {total > 0 ? (
                <><span className="font-semibold text-slate-800">{total.toLocaleString()}</span> results{query ? ` for "${query}"` : ""}</>
              ) : (
                "No results found"
              )}
            </p>
            {total > 0 && (
              <p className="text-xs text-slate-400">Page {page} of {Math.ceil(total / LIMIT)}</p>
            )}
          </div>

          {results.length === 0 ? (
            <div className="card flex flex-col items-center py-16 text-slate-400">
              <Package className="w-12 h-12 mb-3 opacity-20" />
              <p className="font-medium">No products found</p>
              <p className="text-sm mt-1">Try a different search term or clear filters</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {results.map((p) => (
                  <div key={p.id} className="card p-4 hover:shadow-md transition-all duration-200 group">
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                        <Package className="w-5 h-5 text-blue-600" />
                      </div>
                      {p.category && (
                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-lg font-medium">
                          {p.category}
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-900 text-sm leading-snug group-hover:text-blue-600 transition-colors">
                      {p.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-1">{p.sku}</p>
                    {p.description && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">{p.description}</p>
                    )}
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-lg font-bold text-slate-900">${Number(p.price).toFixed(2)}</span>
                      <span className="text-xs text-slate-400">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Pagination page={page} total={total} limit={LIMIT} onChange={(p) => doSearch(p)} />
            </>
          )}
        </>
      )}
    </div>
  );
}
