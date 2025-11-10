export interface Env {
  DB: D1Database;
  RAW: R2Bucket;
  ROOM_COORDINATOR: DurableObjectNamespace;
  AGGREGATE_WINDOW_MS?: string;
  MAX_BATCH_SIZE?: string;
}

export interface IngestEvent {
  tenantId: string;
  streamId: string;
  topic: "metrics" | "events" | "alerts";
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
  sample?: IngestEvent;
  batch: IngestEvent[];
}
