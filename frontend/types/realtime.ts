export interface RealtimeEvent {
  tenantId: string;
  streamId: string;
  topic: string;
  timestamp: number;
  payload: Record<string, unknown>;
  tags?: Record<string, string>;
  importance?: "low" | "normal" | "high";
}

export interface AggregateEnvelope {
  tenantId: string;
  streamId: string;
  topic: string;
  window: {
    from: number;
    to: number;
  };
  mode: "full" | "aggregated";
  metrics: {
    count: number;
    highPriority: number;
    tags: Record<string, number>;
  };
  sample?: RealtimeEvent;
  batch: RealtimeEvent[];
}
