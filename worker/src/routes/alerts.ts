import { json } from "itty-router-extras";
import { z } from "zod";
import type { Env } from "../env.js";
import { authenticate, requireScope, UnauthorizedError } from "../utils/auth.js";

const listQuerySchema = z.object({
  tenantId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function registerAlertRoutes(router: any) {
  router.get("/alerts", async (request: Request, env: Env) => {
    let auth;
    try {
      auth = await authenticate(request, env);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return json({ error: "Unauthorized" }, { status: 401 });
      }
      throw error;
    }
    const params = new URL(request.url).searchParams;

    const query = listQuerySchema.parse({
      tenantId: params.get("tenantId") ?? auth.tenantId,
      limit: params.get("limit") ?? undefined,
    });

    if (query.tenantId !== auth.tenantId) {
      return json({ error: "Tenant mismatch" }, { status: 403 });
    }

    const rows = await env.DB.prepare(
      "SELECT id, stream_id AS streamId, created_at AS createdAt, rule_id AS ruleId, payload, severity, status FROM alerts WHERE tenant_id = ?1 ORDER BY created_at DESC LIMIT ?2"
    )
      .bind(query.tenantId, query.limit)
      .all();

    return json({ items: rows.results ?? [] });
  });

  router.post("/alerts/:id/ack", async (request: Request, env: Env) => {
    let auth;
    try {
      auth = await authenticate(request, env);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return json({ error: "Unauthorized" }, { status: 401 });
      }
      throw error;
    }
    requireScope(auth, "alerts:write");

    const id = (request as any).params.id as string;
    const now = new Date().toISOString();

    await env.DB.prepare(
      "UPDATE alerts SET status = 'ack', acked_at = ?1 WHERE id = ?2 AND tenant_id = ?3"
    )
      .bind(now, id, auth.tenantId)
      .run();

    await env.DB.prepare(
      "INSERT INTO audit_logs (tenant_id, actor, action, entity_type, entity_id, payload, created_at) VALUES (?1, ?2, 'ALERT_ACK', 'alert', ?3, json(?4), ?5)"
    )
      .bind(auth.tenantId, "api", id, JSON.stringify({ id }), now)
      .run();

    return json({ status: "ok" });
  });
}
