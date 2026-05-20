interface Props { status: string; }

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  PENDING:   { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-400" },
  CONFIRMED: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  FAILED:    { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500" },
  CANCELLED: { bg: "bg-slate-100",  text: "text-slate-600",   dot: "bg-slate-400" },
  SHIPPED:   { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  SUCCESS:   { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  up:        { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  down:      { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500" },
};

export default function StatusBadge({ status }: Props) {
  const config = statusConfig[status] ?? { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {status}
    </span>
  );
}
