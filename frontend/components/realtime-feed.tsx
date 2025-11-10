"use client";

import { useMemo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { AggregateEnvelope } from "@/types/realtime";
import dayjs from "dayjs";

interface RealtimeFeedProps {
  aggregates: AggregateEnvelope[];
}

export function RealtimeFeed({ aggregates }: RealtimeFeedProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const rows = useMemo(() => {
    return aggregates.flatMap((envelope) => {
      if (envelope.mode === "aggregated") {
        return [
          {
            key: `${envelope.streamId}-${envelope.window.to}-aggregated`,
            title: `${envelope.metrics.count} eventos agregados`,
            subtitle: `${envelope.topic} · prioridade alta ${envelope.metrics.highPriority}`,
            timestamp: envelope.window.to,
            compressed: true,
          },
        ];
      }

      return envelope.batch.map((event, index) => ({
        key: `${envelope.streamId}-${envelope.window.to}-${index}`,
        title: `${envelope.topic} · ${JSON.stringify(event.payload).slice(0, 80)}`,
        subtitle: `tags: ${Object.entries(event.tags ?? {})
          .map(([k, v]) => `${k}:${v}`)
          .join(", ")}`,
        timestamp: envelope.window.to,
        compressed: false,
      }));
    });
  }, [aggregates]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  return (
    <div className="card p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold">Feed em tempo real</h3>
        <span className="text-xs text-slate-400">{rows.length} itens</span>
      </div>
      <div ref={parentRef} className="flex-1 overflow-y-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = rows[virtualRow.index];
            return (
              <div
                key={item.key}
                className="absolute left-0 right-0 p-3 border-b border-slate-800"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-200">
                    {item.compressed ? item.title : item.title}
                  </span>
                  <span className="text-xs text-slate-500">
                    {dayjs(item.timestamp).format("HH:mm:ss")}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{item.subtitle}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
