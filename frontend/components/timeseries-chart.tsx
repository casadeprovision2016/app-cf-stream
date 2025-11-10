"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TimeseriesChartProps {
  data: Array<{ bucket: string; total: number; high_priority: number }>;
}

export function TimeseriesChart({ data }: TimeseriesChartProps) {
  const chartData = useMemo(() => {
    return data.map((point) => ({
      ...point,
      label: new Date(point.bucket).toLocaleTimeString(),
    }));
  }, [data]);

  return (
    <div className="card p-4 h-80">
      <h3 className="text-lg font-semibold mb-4">Eventos por janela</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ left: 8, right: 8, top: 16, bottom: 8 }}>
          <defs>
            <linearGradient id="colorEvents" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#37a9ff" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#37a9ff" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} minTickGap={48} />
          <YAxis stroke="#64748b" tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: "#0f172a", borderRadius: 8, borderColor: "#1e293b" }}
            labelStyle={{ color: "#e2e8f0" }}
          />
          <Area type="monotone" dataKey="total" stroke="#37a9ff" fill="url(#colorEvents)" strokeWidth={2} />
          <Area type="monotone" dataKey="high_priority" stroke="#f97316" fillOpacity={0} strokeDasharray="4 4" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
