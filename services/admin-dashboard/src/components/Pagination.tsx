import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  total: number;
  limit: number;
  onChange: (page: number) => void;
}

export default function Pagination({ page, total, limit, onChange }: Props) {
  const totalPages = Math.ceil(total / limit);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
      <p className="text-sm text-gray-500">
        Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page === 1}
          className="btn-secondary px-2 py-1.5"
          aria-label="Previous page"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
        </button>
        <span className="px-3 py-1.5 text-sm text-gray-700">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page === totalPages}
          className="btn-secondary px-2 py-1.5"
          aria-label="Next page"
        >
          <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
