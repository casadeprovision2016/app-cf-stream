"use client";

import clsx from "clsx";

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: string;
  loading?: boolean;
}

export function MetricCard({ label, value, delta, loading }: MetricCardProps) {
  return (
    <div className="card p-4 md:p-6 flex flex-col gap-2">
      <span className="text-sm uppercase tracking-wide text-slate-400">{label}</span>
      <span className={clsx("text-3xl font-semibold", loading && "animate-pulse")}>{value}</span>
      {delta && <span className="text-xs text-emerald-400">{delta}</span>}
    </div>
  );
}
