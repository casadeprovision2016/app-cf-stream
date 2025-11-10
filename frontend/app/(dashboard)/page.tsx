"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MetricCard } from "@/components/metric-card";
import { TimeseriesChart } from "@/components/timeseries-chart";
import { RealtimeFeed } from "@/components/realtime-feed";
import { AlertsPanel } from "@/components/alerts-panel";
import { StreamSelector } from "@/components/stream-selector";
import { useRealtimeStream } from "@/hooks/use-realtime-stream";
import { acknowledgeAlert, fetchAlerts, fetchMetrics } from "@/lib/api-client";

const STREAM_OPTIONS = [
  { id: "stream-1", label: "Stream 1" },
  { id: "stream-2", label: "Stream 2" },
];

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT ?? "tenant-a";

export default function DashboardPage() {
  const [tenantId] = useState(DEFAULT_TENANT);
  const [streamId, setStreamId] = useState(STREAM_OPTIONS[0]?.id ?? "stream-1");

  const realtime = useRealtimeStream({ tenantId, streamId });

  const metricsQuery = useQuery({
    queryKey: ["metrics", tenantId, streamId],
    queryFn: () => fetchMetrics({ tenantId, streamId, agg: "minute", limit: 180 }),
    refetchInterval: 15_000,
  });

  const alertsQuery = useQuery({
    queryKey: ["alerts", tenantId],
    queryFn: () => fetchAlerts({ tenantId, limit: 20 }),
    refetchInterval: 10_000,
  });

  const queryClient = useQueryClient();
  const ackMutation = useMutation({
    mutationFn: (alertId: string) => acknowledgeAlert({ tenantId, alertId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["alerts", tenantId] }),
  });

  const latestEnvelope = realtime.lastEnvelope;
  const totalEvents = latestEnvelope?.metrics.count ?? 0;
  const highPriority = latestEnvelope?.metrics.highPriority ?? 0;
  const throughput = useMemo(() => {
    const recent = metricsQuery.data?.slice(-10) ?? [];
    if (recent.length === 0) return 0;
    const sum = recent.reduce((acc, curr) => acc + curr.total, 0);
    return Math.round(sum / recent.length);
  }, [metricsQuery.data]);

  return (
    <div className="p-6 md:p-10 space-y-8">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-100">Dashboard realtime</h1>
          <p className="text-slate-400 text-sm">
            Tenant <span className="font-mono text-slate-200">{tenantId}</span>
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 md:items-end">
          <StreamSelector streams={STREAM_OPTIONS} value={streamId} onChange={setStreamId} />
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">Conexão</span>
            <span
              className="inline-flex items-center gap-2 rounded-full border border-slate-700 px-3 py-1 text-sm"
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  realtime.status === "open"
                    ? "bg-emerald-400"
                    : realtime.status === "connecting"
                    ? "bg-amber-400"
                    : "bg-rose-500"
                }`}
              />
              {realtime.status}
            </span>
          </div>
        </div>
      </header>

      {latestEnvelope?.mode === "aggregated" && (
        <div className="border border-amber-500/50 bg-amber-500/10 text-amber-200 px-4 py-3 rounded-lg">
          Alto volume detectado — stream degradada para modo agregado. Os deltas completos serão retomados quando a
          pressão reduzir.
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard label="Eventos (janela atual)" value={totalEvents} loading={realtime.status !== "open"} />
        <MetricCard label="Prioridade alta" value={highPriority} />
        <MetricCard label="Throughput médio" value={`${throughput} evt/min`} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 min-h-[320px]">
          <TimeseriesChart data={metricsQuery.data ?? []} />
        </div>
        <div className="min-h-[320px]">
          <AlertsPanel
            alerts={alertsQuery.data ?? []}
            onAcknowledge={ackMutation.mutate}
            loading={alertsQuery.isLoading || ackMutation.isPending}
          />
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[360px]">
        <RealtimeFeed aggregates={realtime.aggregates} />
        <div className="card p-4 flex flex-col gap-3">
          <h3 className="text-lg font-semibold">Detalhes da última janela</h3>
          {latestEnvelope ? (
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
              <div>
                <span className="block text-xs text-slate-500 uppercase">Janela</span>
                <span className="font-mono text-slate-200">
                  {new Date(latestEnvelope.window.from).toLocaleTimeString()} -
                  {new Date(latestEnvelope.window.to).toLocaleTimeString()}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-500 uppercase">Modo</span>
                <span className="font-semibold text-slate-100">{latestEnvelope.mode}</span>
              </div>
              <div>
                <span className="block text-xs text-slate-500 uppercase">Tags principais</span>
                <span className="font-mono text-xs text-slate-300">
                  {Object.entries(latestEnvelope.metrics.tags)
                    .slice(0, 4)
                    .map(([tag, count]) => `${tag}(${count})`)
                    .join(", ") || "—"}
                </span>
              </div>
              <div>
                <span className="block text-xs text-slate-500 uppercase">Exemplo</span>
                <span className="font-mono text-xs text-slate-300">
                  {latestEnvelope.sample ? JSON.stringify(latestEnvelope.sample.payload).slice(0, 120) : "—"}
                </span>
              </div>
            </div>
          ) : (
            <span className="text-sm text-slate-500">Aguardando dados do stream selecionado...</span>
          )}
        </div>
      </section>
    </div>
  );
}
