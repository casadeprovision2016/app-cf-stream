"use client";

import type { UseMutationResult } from "@tanstack/react-query";
import dayjs from "dayjs";

interface AlertItem {
  id: string;
  streamId: string;
  createdAt: string;
  ruleId: string;
  payload?: unknown;
  severity: string;
  status: string;
}

interface AlertsPanelProps {
  alerts: AlertItem[];
  onAcknowledge?: UseMutationResult<void, Error, string>["mutate"];
  loading?: boolean;
}

export function AlertsPanel({ alerts, onAcknowledge, loading }: AlertsPanelProps) {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Alertas</h3>
        <span className="text-xs text-slate-400">{alerts.length} ativos</span>
      </div>
      <div className="flex flex-col gap-2 max-h-72 overflow-y-auto scrollbar-thin">
        {loading && alerts.length === 0 && <span className="text-sm text-slate-500">Carregando...</span>}
        {alerts.map((alert) => (
          <div key={alert.id} className="border border-slate-800 rounded-lg p-3 bg-slate-900/70">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-200">{alert.ruleId}</span>
              <span className="text-xs text-slate-500">{dayjs(alert.createdAt).format("DD/MM HH:mm:ss")}</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 break-words">
              {JSON.stringify(alert.payload).slice(0, 160)}
            </p>
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="uppercase tracking-wide text-amber-400">{alert.severity}</span>
              {onAcknowledge && alert.status !== "ack" && (
                <button
                  type="button"
                  className="px-2 py-1 rounded border border-emerald-500 text-emerald-300 hover:bg-emerald-500/10"
                  onClick={() => onAcknowledge(alert.id)}
                >
                  Reconhecer
                </button>
              )}
            </div>
          </div>
        ))}
        {alerts.length === 0 && !loading && <span className="text-sm text-slate-500">Nenhum alerta ativo.</span>}
      </div>
    </div>
  );
}
