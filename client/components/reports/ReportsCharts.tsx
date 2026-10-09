"use client";

import EmptyState from "@/components/ui/EmptyState";
import type { ReportSummary } from "@/lib/reportsApi";

type AttendanceMonth = ReportSummary["attendance"]["trend"][number];

const WIDTH = 900;
const HEIGHT = 320;
const LEFT = 50;
const RIGHT = 16;
const TOP = 18;
const BOTTOM = 48;
const GRAPH_WIDTH = WIDTH - LEFT - RIGHT;
const GRAPH_HEIGHT = HEIGHT - TOP - BOTTOM;

function smoothPath(points: { x: number; y: number }[]) {
  if (points.length < 2) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)];
    const start = points[index];
    const end = points[index + 1];
    const next = points[Math.min(points.length - 1, index + 2)];
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    const c1x = start.x + (end.x - previous.x) / 6;
    const c2x = end.x - (next.x - start.x) / 6;
    const c1y = Math.max(
      minY,
      Math.min(maxY, start.y + (end.y - previous.y) / 6),
    );
    const c2y = Math.max(minY, Math.min(maxY, end.y - (next.y - start.y) / 6));
    path += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`;
  }
  return path;
}

function formatRate(value: number) {
  return `${Number(value).toFixed(1)}%`;
}

export function MonthlyAttendanceChart({ data }: { data: AttendanceMonth[] }) {
  const total = data.reduce((sum, item) => sum + item.present + item.absent, 0);
  if (!total) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <EmptyState
          title="No attendance data"
          description="No regular attendance was recorded for the selected period."
        />
      </div>
    );
  }

  const maxCount = Math.max(
    0,
    ...data.map((item) => Math.max(item.present, item.absent)),
  );
  const step = Math.max(1, Math.ceil(maxCount / 4));
  const axisMax = step * 4;
  const groupWidth = GRAPH_WIDTH / Math.max(data.length, 1);
  const barWidth = Math.min(18, groupWidth * 0.31);
  const y = (count: number) =>
    TOP + GRAPH_HEIGHT - (count / axisMax) * GRAPH_HEIGHT;

  return (
    <div className="mt-4 w-full overflow-x-auto pb-2">
      <div className="mb-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-(--ink-muted)">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-(--accent)" />
          Present
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-sm bg-(--danger)" />
          Absent
        </span>
        <span className="ml-auto">Regular attendance records</span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="block h-auto min-w-[680px] w-full overflow-visible 2xl:min-w-0"
        role="img"
        aria-label="Monthly regular attendance grouped bar chart showing present and absent records"
      >
        {Array.from({ length: 5 }, (_, index) => {
          const count = axisMax - step * index;
          const lineY = TOP + (GRAPH_HEIGHT / 4) * index;
          return (
            <g key={index}>
              <line
                x1={LEFT}
                x2={WIDTH - RIGHT}
                y1={lineY}
                y2={lineY}
                stroke="var(--line)"
                strokeDasharray="3 5"
              />
              <text
                x={LEFT - 9}
                y={lineY + 4}
                textAnchor="end"
                fill="var(--ink-muted)"
                fontSize="11"
              >
                {count}
              </text>
            </g>
          );
        })}
        {data.map((item, index) => {
          const center = LEFT + groupWidth * (index + 0.5);
          const totalForMonth = item.present + item.absent;
          const rate = totalForMonth ? (item.present / totalForMonth) * 100 : 0;
          const presentY = y(item.present);
          const absentY = y(item.absent);
          return (
            <g key={item.month}>
              <rect
                x={center - barWidth - 1}
                y={presentY}
                width={barWidth}
                height={Math.max(0, TOP + GRAPH_HEIGHT - presentY)}
                rx="3"
                fill="var(--accent)"
                opacity={item.present ? 1 : 0}
              >
                <title>
                  {item.month}: Present {item.present}; Absent {item.absent};
                  Total {totalForMonth}; Attendance rate {formatRate(rate)}
                </title>
              </rect>
              <rect
                x={center + 1}
                y={absentY}
                width={barWidth}
                height={Math.max(0, TOP + GRAPH_HEIGHT - absentY)}
                rx="3"
                fill="var(--danger)"
                opacity={item.absent ? 1 : 0}
              >
                <title>
                  {item.month}: Present {item.present}; Absent {item.absent};
                  Total {totalForMonth}; Attendance rate {formatRate(rate)}
                </title>
              </rect>
              <text
                x={center}
                y={HEIGHT - 13}
                textAnchor="middle"
                fill="var(--ink-muted)"
                fontSize="12"
              >
                {item.month}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AttendanceRateChart({ data }: { data: AttendanceMonth[] }) {
  const points = data.flatMap((item, index) =>
    item.total > 0 && item.attendanceRate !== null
      ? [
          {
            x: LEFT + (index / Math.max(1, data.length - 1)) * GRAPH_WIDTH,
            y: TOP + GRAPH_HEIGHT - (item.attendanceRate / 100) * GRAPH_HEIGHT,
            item,
          },
        ]
      : [],
  );
  if (!points.length) {
    return (
      <div className="flex min-h-72 items-center justify-center">
        <EmptyState
          title="No attendance data"
          description="The attendance rate trend appears when regular attendance is recorded."
        />
      </div>
    );
  }
  const segments: (typeof points)[] = [];
  let segment: typeof points = [];
  data.forEach((item, index) => {
    if (item.total > 0 && item.attendanceRate !== null) {
      segment.push(points.find((point) => point.item.month === item.month)!);
    } else if (segment.length) {
      segments.push(segment);
      segment = [];
    }
    if (index === data.length - 1 && segment.length) segments.push(segment);
  });

  return (
    <div className="mt-4 w-full overflow-x-auto pb-2">
      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-(--ink-muted)">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-(--accent)" />
          Attendance rate
        </span>
        <span>Scale: 0%–100%</span>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="block h-auto min-w-[680px] w-full overflow-visible 2xl:min-w-0"
        role="img"
        aria-label="Monthly regular attendance rate trend from zero to one hundred percent"
      >
        {Array.from({ length: 5 }, (_, index) => {
          const rate = 100 - index * 25;
          const lineY = TOP + (GRAPH_HEIGHT / 4) * index;
          return (
            <g key={rate}>
              <line
                x1={LEFT}
                x2={WIDTH - RIGHT}
                y1={lineY}
                y2={lineY}
                stroke="var(--line)"
                strokeDasharray="3 5"
              />
              <text
                x={LEFT - 9}
                y={lineY + 4}
                textAnchor="end"
                fill="var(--ink-muted)"
                fontSize="11"
              >
                {rate}%
              </text>
            </g>
          );
        })}
        {segments.map((part, index) =>
          part.length > 1 ? (
            <path
              key={index}
              d={smoothPath(part)}
              fill="none"
              stroke="var(--accent)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              pathLength={1}
              className="report-chart-line"
            />
          ) : null,
        )}
        {data.map((item, index) => {
          const point = points.find((entry) => entry.item.month === item.month);
          const x = LEFT + (index / Math.max(1, data.length - 1)) * GRAPH_WIDTH;
          return (
            <g key={item.month}>
              {point && (
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4.5"
                  fill="var(--card)"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                >
                  <title>
                    {item.month}: Present {item.present}; Absent {item.absent};
                    Attendance rate {formatRate(item.attendanceRate!)}
                  </title>
                </circle>
              )}
              <text
                x={x}
                y={HEIGHT - 13}
                textAnchor="middle"
                fill="var(--ink-muted)"
                fontSize="12"
              >
                {item.month}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function AttendanceDistribution({
  present,
  absent,
}: {
  present: number;
  absent: number;
}) {
  const total = present + absent;
  if (!total) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <EmptyState
          title="No attendance data"
          description="There are no regular attendance records in this period."
        />
      </div>
    );
  }
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const presentLength = (present / total) * circumference;
  const absentLength = circumference - presentLength;
  const rate = (present / total) * 100;

  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-5 sm:flex-row sm:gap-8">
      <div
        className="relative h-40 w-40 shrink-0"
        role="img"
        aria-label={`Attendance distribution: ${present} present, ${absent} absent, ${formatRate(rate)} attendance rate`}
      >
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="var(--line)"
            strokeWidth="14"
          />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="14"
            strokeDasharray={`${presentLength} ${circumference - presentLength}`}
            strokeLinecap="butt"
          >
            <title>
              Present: {present} of {total}
            </title>
          </circle>
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="var(--danger)"
            strokeWidth="14"
            strokeDasharray={`${absentLength} ${circumference - absentLength}`}
            strokeDashoffset={-presentLength}
          >
            <title>
              Absent: {absent} of {total}
            </title>
          </circle>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-extrabold tracking-tight text-(--foreground)">
            {formatRate(rate)}
          </span>
          <span className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-(--ink-muted)">
            Attendance rate
          </span>
        </div>
      </div>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-7">
          <span className="inline-flex items-center gap-2 text-(--ink-muted)">
            <span className="h-2.5 w-2.5 rounded-sm bg-(--accent)" />
            Present
          </span>
          <strong className="text-(--foreground)">
            {present.toLocaleString()}
          </strong>
        </div>
        <div className="flex items-center justify-between gap-7">
          <span className="inline-flex items-center gap-2 text-(--ink-muted)">
            <span className="h-2.5 w-2.5 rounded-sm bg-(--danger)" />
            Absent
          </span>
          <strong className="text-(--foreground)">
            {absent.toLocaleString()}
          </strong>
        </div>
        <div className="flex items-center justify-between gap-7 border-t border-(--line) pt-3">
          <span className="text-(--ink-muted)">Total</span>
          <strong className="text-(--foreground)">
            {total.toLocaleString()}
          </strong>
        </div>
      </div>
    </div>
  );
}
