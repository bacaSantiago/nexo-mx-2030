import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { EvidenceRow } from "@/lib/analytics/types";
import { formatValue } from "@/lib/format";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Horizontal bar list with labels above bars so long Spanish labels never clip. */
export function BarList({ rows, accent = "teal" }: { rows: EvidenceRow[]; accent?: "teal" | "coral" | "primary" }) {
  const max = Math.max(...rows.map((r) => r.estimate), 1);
  const color = accent === "coral" ? "bg-coral" : accent === "primary" ? "bg-primary" : "bg-teal";
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.id} className="min-w-0">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate" title={r.label}>
              {r.label}
            </span>
            <span className="tabular shrink-0 font-semibold">{formatValue(r.estimate, r.unit)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted" aria-hidden>
            <div className={`h-2 rounded-full ${color}`} style={{ width: `${(r.estimate / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

type Series = { key: string; label: string; color: string };

export function TrendChart({
  data,
  series,
  unit,
  height = 240,
}: {
  data: Record<string, number | string | null>[];
  series: Series[];
  unit: string;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="year" tick={axis} tickLine={false} axisLine={false} />
          <YAxis tick={axis} tickLine={false} axisLine={false} domain={[0, 100]} width={44} />
          <Tooltip
            formatter={(v: number) => formatValue(v, unit)}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={2.25}
              dot={{ r: 3 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function GroupedBars({
  data,
  series,
  unit,
  height = 260,
}: {
  data: Record<string, number | string | null>[];
  series: Series[];
  unit: string;
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={axis} tickLine={false} axisLine={false} interval={0} />
          <YAxis tick={axis} tickLine={false} axisLine={false} width={44} />
          <Tooltip
            formatter={(v: number) => formatValue(v, unit)}
            contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          {series.map((s) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
