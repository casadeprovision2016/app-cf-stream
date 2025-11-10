"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import type { AggregateEnvelope } from "@/types/realtime";

const messageSchema = z.object({
  type: z.enum(["joined", "aggregate"]),
  data: z.any().optional(),
});

interface UseRealtimeOptions {
  tenantId: string;
  streamId: string;
  topic?: string;
  autoReconnect?: boolean;
}

interface RealtimeState {
  status: "idle" | "connecting" | "open" | "closed" | "error";
  aggregates: AggregateEnvelope[];
  lastEnvelope?: AggregateEnvelope;
  error?: string;
  send: (payload: unknown) => void;
}

export function useRealtimeStream(options: UseRealtimeOptions): RealtimeState {
  const { tenantId, streamId } = options;
  const topic = options.topic ?? "metrics";
  type State = Omit<RealtimeState, "send">;
  const [state, setState] = useState<State>({
    status: "idle",
    aggregates: [],
  });

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const endpoint = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_WS_BASE;
    if (!base || !tenantId || !streamId) return null;
    const url = new URL(base);
    url.searchParams.set("tenantId", tenantId);
    url.searchParams.set("streamId", streamId);
    url.searchParams.set("topic", topic);
    return url.toString();
  }, [tenantId, streamId, topic]);

  useEffect(() => {
    if (!endpoint) return;

  setState((prev: State) => ({ ...prev, status: "connecting", error: undefined }));
    const socket = new WebSocket(endpoint, []);
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setState((prev: State) => ({ ...prev, status: "open" }));
    });

    socket.addEventListener("message", (event) => {
      try {
        const parsed = messageSchema.parse(JSON.parse(event.data as string));
        if (parsed.type === "aggregate" && parsed.data) {
          const envelope = parsed.data as AggregateEnvelope;
          setState((prev: State) => ({
            ...prev,
            aggregates: [...prev.aggregates.slice(-199), envelope],
            lastEnvelope: envelope,
          }));
        }
      } catch (error) {
        console.error("Failed to parse realtime message", error);
      }
    });

    socket.addEventListener("close", () => {
  setState((prev: State) => ({ ...prev, status: "closed" }));
      if (options.autoReconnect !== false) {
        reconnectRef.current = setTimeout(() => {
          socketRef.current = null;
          setState({ status: "idle", aggregates: [] });
        }, 1500);
      }
    });

    socket.addEventListener("error", (event) => {
      console.error("Realtime socket error", event);
  setState((prev: State) => ({ ...prev, status: "error", error: "socket-error" }));
      socket.close(1011, "error");
    });

    return () => {
      socket.close(1000, "cleanup");
      if (reconnectRef.current) {
        clearTimeout(reconnectRef.current);
        reconnectRef.current = null;
      }
    };
  }, [endpoint, options.autoReconnect]);

  const send = (payload: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    }
  };

  return { ...state, send };
}
