import type { Env, IngestEvent, AggregateEnvelope } from "../env.js";
import { AggregateBuffer } from "../utils/aggregator.js";

interface Connection {
  socket: WebSocket;
  tenantId: string;
  streamId: string;
  topic: string;
}

const DEFAULT_WINDOW_MS = 1_000;
const DEFAULT_BATCH_SIZE = 128;

export class RoomCoordinator implements DurableObject {
  private readonly state: DurableObjectState;
  private readonly env: Env;
  private readonly connections = new Map<string, Connection>();
  private readonly buffers = new Map<string, AggregateBuffer>();
  private nextAlarm: number | null = null;
  private readonly windowMs: number;
  private readonly maxBatch: number;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.windowMs = Number(env.AGGREGATE_WINDOW_MS ?? DEFAULT_WINDOW_MS);
    this.maxBatch = Number(env.MAX_BATCH_SIZE ?? DEFAULT_BATCH_SIZE);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === "POST") {
      const url = new URL(request.url);
      if (url.pathname === "/publish") {
        const payload = await request.json<{ events: IngestEvent[] }>();
        await this.handlePublish(payload.events);
        return new Response(null, { status: 202 });
      }
    }

    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request.headers);
    }

    return new Response("Not Found", { status: 404 });
  }

  private handleWebSocket(headers: Headers): Response {
    const tenantId = headers.get("X-Tenant-Id");
    const streamId = headers.get("X-Stream-Id");
    const topic = headers.get("X-Topic") ?? "metrics";

    if (!tenantId || !streamId) {
      return new Response("Missing identifiers", { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];

    const id = crypto.randomUUID();
    this.connections.set(id, {
      socket: server,
      tenantId,
      streamId,
      topic,
    });

    server.accept();
    server.addEventListener("close", () => this.connections.delete(id));
    server.addEventListener("error", () => this.connections.delete(id));

    server.send(
      JSON.stringify({
        type: "joined",
        streamId,
        topic,
        tenantId,
        timestamp: Date.now(),
      })
    );

    return new Response(null, { status: 101, webSocket: client });
  }

  private async handlePublish(events: IngestEvent[]) {
    if (!events.length) return;

    for (const event of events) {
      const key = `${event.tenantId}:${event.streamId}:${event.topic}`;
      let buffer = this.buffers.get(key);
      if (!buffer) {
        buffer = new AggregateBuffer({
          tenantId: event.tenantId,
          streamId: event.streamId,
          topic: event.topic,
          windowMs: this.windowMs,
          maxBatch: this.maxBatch,
        });
        this.buffers.set(key, buffer);
      }

      const envelope = buffer.append(event);
      if (envelope) {
        this.broadcast(envelope);
      }

      const windowEnd = Math.floor(event.timestamp / this.windowMs) * this.windowMs + this.windowMs;
      this.scheduleAlarm(windowEnd + 1);
    }
  }

  private broadcast(envelope: AggregateEnvelope) {
    const payload = JSON.stringify({ type: "aggregate", data: envelope });
    for (const connection of this.connections.values()) {
      if (
        connection.tenantId === envelope.tenantId &&
        connection.streamId === envelope.streamId &&
        connection.topic === envelope.topic
      ) {
        try {
          connection.socket.send(payload);
        } catch (error) {
          connection.socket.close(1011, (error as Error).message);
        }
      }
    }
  }

  private scheduleAlarm(alarmAt: number) {
    if (this.nextAlarm && this.nextAlarm <= alarmAt) {
      return;
    }

    this.nextAlarm = alarmAt;
    this.state.storage.setAlarm(alarmAt);
  }

  async alarm() {
    this.nextAlarm = null;
    const now = Date.now();
    for (const [key, buffer] of this.buffers.entries()) {
      const envelope = buffer.flush(now);
      if (envelope) {
        this.broadcast(envelope);
      }
      if (!envelope) {
        // Keep buffer for next window.
        continue;
      }
      if (!this.buffers.get(key)) {
        continue;
      }
    }
  }
}
