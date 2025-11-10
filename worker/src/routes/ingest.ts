import { json } from "itty-router-extras";
import type { ExecutionContext } from "@cloudflare/workers-types";
import { z } from "zod";
import type { Env, IngestEvent } from "../env.js";
import { authenticate, UnauthorizedError } from "../utils/auth.js";

const ingestEventSchema = z.object({
  tenantId: z.string().min(1),
  streamId: z.string().min(1),
  topic: z.enum(["metrics", "events", "alerts"]),
  timestamp: z.number().int().optional(),
  payload: z.record(z.any()),
  tags: z.record(z.string()).optional(),
  importance: z.enum(["low", "normal", "high"]).optional(),
});

const ingestBodySchema = z.object({
  events: z.array(ingestEventSchema).min(1).max(512),
  clientTimestamp: z.number().optional(),
});

export function registerIngestRoutes(router: any) {
  router.post("/ingest", async (request: Request, env: Env, ctx: ExecutionContext) => {
    let auth;
    try {
      auth = await authenticate(request, env);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return json({ error: "Unauthorized" }, { status: 401 });
      }
      throw error;
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return json({ error: "Unsupported Media Type" }, { status: 415 });
    }

    let parsed: z.infer<typeof ingestBodySchema>;
    try {
      parsed = ingestBodySchema.parse(await request.json());
    } catch (error) {
      return json({ error: "Invalid payload", details: (error as Error).message }, { status: 400 });
    }

    const now = Date.now();
  const events: IngestEvent[] = parsed.events.map((event: z.infer<typeof ingestEventSchema>) => ({
      ...event,
      tenantId: event.tenantId,
      streamId: event.streamId,
      timestamp: event.timestamp ?? now,
      importance: event.importance ?? "normal",
    }));

    for (const event of events) {
      if (event.tenantId !== auth.tenantId) {
        return json({ error: "Tenant mismatch" }, { status: 403 });
      }
    }

    const r2Promises = events.map((event) => {
      const key = `${event.tenantId}/${event.streamId}/${event.timestamp}-${crypto.randomUUID()}.json`;
      const body = JSON.stringify({ event, receivedAt: now, clientTimestamp: parsed.clientTimestamp });
      return env.RAW.put(key, body, {
        httpMetadata: {
          contentType: "application/json",
        },
      });
    });

    const d1Statements = events.map((event) => {
      const summary = JSON.stringify({
        topic: event.topic,
        importance: event.importance,
        tags: event.tags ?? {},
      });
      return env.DB.prepare(
        "INSERT INTO events_recent (tenant_id, stream_id, topic, ts, importance, payload_summary) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
      )
        .bind(event.tenantId, event.streamId, event.topic, new Date(event.timestamp).toISOString(), event.importance, summary);
    });

    ctx.waitUntil(Promise.all(r2Promises));
    ctx.waitUntil(env.DB.batch(d1Statements));

    const byStream = new Map<string, IngestEvent[]>();
    for (const event of events) {
      const key = `${event.tenantId}:${event.streamId}:${event.topic}`;
      const list = byStream.get(key) ?? [];
      list.push(event);
      byStream.set(key, list);
    }

    for (const [key, grouped] of byStream.entries()) {
      const roomId = env.ROOM_COORDINATOR.idFromName(key);
      const stub = env.ROOM_COORDINATOR.get(roomId);
      ctx.waitUntil(
        stub.fetch("https://room-coordinator/publish", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ events: grouped }),
        })
      );
    }

    return json({ accepted: events.length }, { status: 202 });
  });
}
