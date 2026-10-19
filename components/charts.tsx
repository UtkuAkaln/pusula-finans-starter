"use client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { money } from "@/lib/finance";
import type { Bucket } from "@/lib/types";
const axis = { fontSize: 11, fill: "#7f8583" };
const tooltip = {
  background: "#202523",
  border: "1px solid #39423b",
  borderRadius: 12,
  color: "#edf1e9",
  fontSize: 12,
};
export function SpendingDonut({
  data,
}: {
  data: { name: string; value: number; color: string }[];
}) {
  const total = data.reduce((s, r) => s + r.value, 0);
  return (
    <div className="spending-donut">
      <div
        className="donut-visual"
        role="img"
        aria-label={`Harcama dağılımı, toplam ${money(total)}`}
      >
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={
                total
                  ? data
                  : [{ name: "Harcama yok", value: 1, color: "#2c332d" }]
              }
              dataKey="value"
              nameKey="name"
              innerRadius="65%"
              outerRadius="88%"
              paddingAngle={total ? 3 : 0}
              stroke="none"
            >
              {(total
                ? data
                : [{ name: "Harcama yok", value: 1, color: "#2c332d" }]
              ).map((r) => (
                <Cell key={r.name} fill={r.color} />
              ))}
            </Pie>
            {total > 0 && (
              <Tooltip
                contentStyle={tooltip}
                formatter={(v) => money(Number(v))}
              />
            )}
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <small>Toplam harcama</small>
          <strong>{money(total, true)}</strong>
        </div>
      </div>
      <div className="donut-legend">
        {data.map((r) => (
          <div key={r.name}>
            <span>
              <i style={{ background: r.color }} />
              {r.name}
            </span>
            <strong>
              {money(r.value, true)}{" "}
              <small>%{Math.round((r.value / total) * 100)}</small>
            </strong>
          </div>
        ))}
        {!total && <p className="muted">Seçili ayda harcama yok.</p>}
      </div>
    </div>
  );
}
export function FlowChart({
  data,
}: {
  data: Record<string, string | number>[];
}) {
  return (
    <div className="chart-area">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          barGap={5}
          barCategoryGap="27%"
          margin={{ top: 10, right: 0, bottom: 0, left: -16 }}
        >
          <CartesianGrid
            stroke="#2a302d"
            vertical={false}
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="name"
            tick={axis}
            axisLine={false}
            tickLine={false}
            dy={8}
          />
          <YAxis
            tick={axis}
            tickFormatter={(v) => `${Number(v) / 1000}b`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "#ffffff05" }}
            contentStyle={tooltip}
            formatter={(v, n) => [
              money(Number(v), true),
              n === "income" ? "Gelir" : "Gider",
            ]}
          />
          <Bar
            dataKey="income"
            name="income"
            fill="#b4d797"
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
          />
          <Bar
            dataKey="expense"
            name="expense"
            fill="#4b6150"
            radius={[4, 4, 0, 0]}
            maxBarSize={16}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
export function ProjectionChart({
  data,
}: {
  data: Record<string, string | number>[];
}) {
  return (
    <div className="chart-area projection-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 16, right: 8, bottom: 0, left: -8 }}
        >
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b4d797" stopOpacity={0.23} />
              <stop offset="100%" stopColor="#b4d797" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            stroke="#2a302d"
            vertical={false}
            strokeDasharray="3 5"
          />
          <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
          <YAxis
            tick={axis}
            tickFormatter={(v) => `${Math.round(Number(v) / 1000)}b`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltip}
            formatter={(v) => [money(Number(v), true), "Ay sonu bakiye"]}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#b4d797"
            strokeWidth={2.5}
            fill="url(#balanceGradient)"
            dot={{ r: 3, fill: "#b4d797", stroke: "#1c211e", strokeWidth: 3 }}
            activeDot={{ r: 5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function BucketHistoryChart({
  data,
  buckets,
}: {
  data: Record<string, string | number>[];
  buckets: Bucket[];
}) {
  return (
    <div className="chart-area">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 10, right: 10, bottom: 0, left: -15 }}
        >
          <CartesianGrid stroke="#2a302d" vertical={false} />
          <XAxis dataKey="name" tick={axis} axisLine={false} tickLine={false} />
          <YAxis
            tick={axis}
            tickFormatter={(v) => `${v}%`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={tooltip}
            formatter={(v, n) => [
              `${v}%`,
              buckets.find((b) => b.id === n)?.name || n,
            ]}
          />
          {buckets.map((b) => (
            <Line
              key={b.id}
              type="monotone"
              dataKey={b.id}
              stroke={b.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
