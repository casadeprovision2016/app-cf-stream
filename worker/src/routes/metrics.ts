import { json } from "itty-router-extras";
import { z } from "zod";
import type { Env } from "../env.js";
import { authenticate, UnauthorizedError } from "../utils/auth.js";

const metricsQuerySchema = z.object({
  tenantId: z.string().min(1),
  streamId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  agg: z.enum(["minute", "hour", "day"]).default("minute"),
  limit: z.coerce.number().int().min(10).max(2000).default(200),
});

const STRFTIME_FORMAT: Record<string, string> = {
  minute: "%Y-%m-%dT%H:%M:00Z",
  hour: "%Y-%m-%dT%H:00:00Z",
  day: "%Y-%m-%dT00:00:00Z",
};

export function registerMetricsRoutes(router: any) {
  router.get("/metrics", async (request: Request, env: Env) => {
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
    const queryParams = metricsQuerySchema.parse({
      tenantId: params.get("tenantId") ?? auth.tenantId,
      streamId: params.get("streamId") ?? undefined,
      from: params.get("from") ?? undefined,
      to: params.get("to") ?? undefined,
      agg: params.get("agg") ?? undefined,
      limit: params.get("limit") ?? undefined,
    });

    if (queryParams.tenantId !== auth.tenantId) {
      return json({ error: "Tenant mismatch" }, { status: 403 });
    }

    const { agg, limit } = queryParams;
    const format = STRFTIME_FORMAT[agg];
    const sqlParts = [
      "SELECT strftime(?1, datetime(ts)) AS bucket,",
      " COUNT(*) AS total,",
      " SUM(CASE WHEN importance = 'high' THEN 1 ELSE 0 END) AS high_priority",
      " FROM events_recent WHERE tenant_id = ?2",
    ];

    const binds: any[] = [format, queryParams.tenantId];
    let placeholder = 3;

    if (queryParams.streamId) {
      sqlParts.push(` AND stream_id = ?${placeholder}`);
      binds.push(queryParams.streamId);
      placeholder += 1;
    }

    if (queryParams.from) {
      sqlParts.push(` AND ts >= ?${placeholder}`);
      binds.push(queryParams.from);
      placeholder += 1;
    }

    if (queryParams.to) {
      sqlParts.push(` AND ts <= ?${placeholder}`);
      binds.push(queryParams.to);
      placeholder += 1;
    }

    sqlParts.push(` GROUP BY bucket ORDER BY bucket DESC LIMIT ?${placeholder}`);
    binds.push(limit);

    const statement = env.DB.prepare(sqlParts.join("")).bind(...binds);
    const rows = await statement.all<{ bucket: string; total: number; high_priority: number }>();

    return json({ items: rows.results?.reverse() ?? [] });
  });
}
