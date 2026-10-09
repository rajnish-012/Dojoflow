import EmptyState from "@/components/ui/EmptyState";
import { Activity } from "lucide-react";

export type ExecutiveChartPoint = { label: string; value: number };

function monthLabel(value: string) {
  const date = /^\d{4}-\d{2}$/.test(value)
    ? new Date(`${value}-01T12:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { month: "short", year: "2-digit" }).format(date);
}

/** Compact ForceStrike themed SVG line/area chart for existing dashboard aggregates. */
export function ExecutiveLineChart({
  rows,
  valueLabel,
  color = "var(--accent)",
  domainMax,
  format = (value: number) => String(value),
  empty = "No data in this date range.",
}: {
  rows: ExecutiveChartPoint[];
  valueLabel: string;
  color?: string;
  domainMax?: number;
  format?: (value: number) => string;
  empty?: string;
}) {
  if (!rows.length) {
    return <EmptyState title="No chart data yet" description={empty} icon={<Activity size={20} />} />;
  }
  const width = 720;
  const height = 220;
  const left = 48;
  const right = 16;
  const top = 18;
  const bottom = 38;
  const max = domainMax ?? Math.max(1, ...rows.map((row) => row.value)) * 1.15;
  const x = (index: number) => left + index * ((width - left - right) / Math.max(1, rows.length - 1));
  const y = (value: number) => top + (height - top - bottom) * (1 - value / max);
  const points = rows.map((row, index) => `${x(index)},${y(row.value)}`).join(" ");
  const area = `${left},${height - bottom} ${points} ${x(rows.length - 1)},${height - bottom}`;
  return (
    <div className="w-full min-w-0 overflow-x-auto pb-1" role="img" aria-label={`${valueLabel} trend chart`}>
      <div className="mb-2 flex items-center justify-between text-xs text-(--ink-muted)"><span>{valueLabel}</span><span>{rows.length} periods</span></div>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto max-h-[210px] min-w-[560px] w-full 2xl:min-w-0" preserveAspectRatio="none">
        {[0, 1, 2, 3].map((line) => {
          const yy = top + line * ((height - top - bottom) / 3);
          return <g key={line}><line x1={left} x2={width - right} y1={yy} y2={yy} stroke="var(--line)" strokeDasharray="3 5" /><text x={left - 8} y={yy + 4} textAnchor="end" fill="var(--ink-faint)" fontSize="11">{format(max * (1 - line / 3))}</text></g>;
        })}
        <polygon points={area} fill={color} opacity="0.08" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {rows.map((row, index) => <g key={`${row.label}-${index}`}><circle cx={x(index)} cy={y(row.value)} r="4" fill="var(--card)" stroke={color} strokeWidth="2"><title>{`${row.label}: ${format(row.value)}`}</title></circle><text x={x(index)} y={height - 10} textAnchor="middle" fill="var(--ink-muted)" fontSize="11">{monthLabel(row.label)}</text></g>)}
      </svg>
    </div>
  );
}

/** Compact horizontal comparison used for supporting branch/program summaries. */
export function ComparisonList({
  rows,
  format = (value: number) => value.toLocaleString(),
  color = "var(--accent)",
  empty = "No comparison data available.",
}: {
  rows: { name: string; value: number }[];
  format?: (value: number) => string;
  color?: string;
  empty?: string;
}) {
  if (!rows.length) return <p className="py-3 text-sm text-(--ink-muted)">{empty}</p>;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return <div className="space-y-3">{rows.slice(0, 8).map((row, index) => <div key={`${row.name}-${index}`}>
    <div className="mb-1 flex items-center justify-between gap-3 text-xs"><span className="min-w-0 truncate text-(--ink-muted)">{row.name}</span><span className="shrink-0 font-semibold text-(--foreground)">{format(row.value)}</span></div>
    <div className="h-2 overflow-hidden rounded-full bg-(--surface-muted)"><div className="h-full rounded-full" style={{ width: `${Math.max(row.value > 0 ? 2 : 0, row.value / max * 100)}%`, backgroundColor: color }} /></div>
  </div>)}</div>;
}
