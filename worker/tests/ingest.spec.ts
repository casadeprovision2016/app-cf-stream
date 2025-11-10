import { describe, expect, it } from "vitest";
import { Router } from "itty-router";
import type {
  D1Database,
  DurableObjectNamespace,
  ExecutionContext,
  R2Bucket,
} from "@cloudflare/workers-types";
import type { Env, IngestEvent } from "../src/env.js";
import { registerIngestRoutes } from "../src/routes/ingest.js";
import { registerHealthRoutes } from "../src/routes/health.js";

class FakeStatement {
  private params: unknown[] = [];
  constructor(private readonly db: FakeDB, private readonly sql: string) {}

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async first<T>() {
    if (this.sql.includes("FROM api_tokens")) {
      const token = this.params[0];
      return this.db.lookupToken(token as string) as T;
    }
    if (this.sql.trim() === "SELECT 1") {
      return { 1: 1 } as T;
    }
    return undefined as T;
  }

  async run() {
    if (this.sql.startsWith("INSERT INTO events_recent")) {
      this.db.events.push(this.params as [string, string, string, string, string, string]);
    }
    if (this.sql.startsWith("UPDATE alerts")) {
      this.db.alertUpdates.push(this.params as [string, string, string]);
    }
    if (this.sql.startsWith("INSERT INTO audit_logs")) {
      this.db.auditLogs.push(this.params as [string, string, string, string, string, string, string]);
    }
  }
}

class FakeDB {
  tokens = new Map<string, { tenant_id: string; scopes: string | null }>();
  events: Array<[string, string, string, string, string, string]> = [];
  alertUpdates: Array<[string, string, string]> = [];
  auditLogs: Array<[string, string, string, string, string, string, string]> = [];

  prepare(sql: string) {
    return new FakeStatement(this, sql);
  }

  async batch(statements: FakeStatement[]) {
    for (const statement of statements) {
      await statement.run();
    }
  }

  lookupToken(token: string) {
    return this.tokens.get(token) ?? null;
  }
}

class FakeR2 {
  items: { key: string; body: string }[] = [];

  async put(key: string, body: string) {
    this.items.push({ key, body });
  }

  async head() {
    return undefined;
  }
}

class FakeDurableObjectStub {
  constructor(private readonly handler: (events: IngestEvent[]) => void) {}

  async fetch(_input: Request | string, init?: RequestInit) {
    const body = init?.body ? JSON.parse(init.body as string) : {};
    this.handler(body.events ?? []);
    return new Response(null, { status: 202 });
  }
}

class FakeDurableObjectNamespace {
  published: IngestEvent[][] = [];

  idFromName(name: string) {
    return name;
  }

  get() {
    return new FakeDurableObjectStub((events) => {
      this.published.push(events);
    });
  }
}

class FakeExecutionContext implements ExecutionContext {
  waits: Promise<unknown>[] = [];
  waitUntil(promise: Promise<unknown>) {
    this.waits.push(promise);
  }
  passThroughOnException() {}
}

describe("/ingest", () => {
  it("accepts events, stores metadata and fanouts to Durable Object", async () => {
    const db = new FakeDB();
    const token = "token-123";
    db.tokens.set(token, { tenant_id: "tenant-a", scopes: JSON.stringify(["alerts:write"]) });

    const env: Env = {
      DB: db as unknown as D1Database,
      RAW: new FakeR2() as unknown as R2Bucket,
      ROOM_COORDINATOR: new FakeDurableObjectNamespace() as unknown as DurableObjectNamespace,
      AGGREGATE_WINDOW_MS: "1000",
      MAX_BATCH_SIZE: "128",
    };

    const router = Router();
    registerHealthRoutes(router);
    registerIngestRoutes(router);

    const body = {
      events: [
        {
          tenantId: "tenant-a",
          streamId: "stream-1",
          topic: "metrics",
          payload: { value: 42 },
          tags: { sensor: "alpha" },
        },
      ],
    };

    const request = new Request("https://example.com/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const ctx = new FakeExecutionContext();
    const response = await router.handle(request, env, ctx);

    expect(response.status).toBe(202);
    await Promise.all(ctx.waits);

    expect(db.events.length).toBe(1);
    expect((env.RAW as unknown as FakeR2).items.length).toBe(1);
    expect((env.ROOM_COORDINATOR as unknown as FakeDurableObjectNamespace).published[0][0].streamId).toBe("stream-1");
  });

  it("rejects payloads for mismatched tenant", async () => {
    const db = new FakeDB();
    const token = "token-tenant";
    db.tokens.set(token, { tenant_id: "tenant-a", scopes: null });

    const env: Env = {
      DB: db as unknown as D1Database,
      RAW: new FakeR2() as unknown as R2Bucket,
      ROOM_COORDINATOR: new FakeDurableObjectNamespace() as unknown as DurableObjectNamespace,
      AGGREGATE_WINDOW_MS: "1000",
      MAX_BATCH_SIZE: "128",
    };

    const router = Router();
    registerIngestRoutes(router);

    const body = {
      events: [
        {
          tenantId: "tenant-b",
          streamId: "stream-1",
          topic: "metrics",
          payload: { value: 10 },
        },
      ],
    };

    const request = new Request("https://example.com/ingest", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const ctx = new FakeExecutionContext();
    const response = await router.handle(request, env, ctx);

    expect(response.status).toBe(403);
  });
});
