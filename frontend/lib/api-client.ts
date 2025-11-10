import { z } from "zod";

const metricsSchema = z.object({
  items: z.array(
    z.object({
      bucket: z.string(),
      total: z.number(),
      high_priority: z.number(),
    })
  ),
});

const alertsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      streamId: z.string(),
      createdAt: z.string(),
      ruleId: z.string(),
      payload: z.any(),
      severity: z.string(),
      status: z.string(),
    })
  ),
});

function getApiBase() {
  const base = process.env.NEXT_PUBLIC_API_BASE;
  if (!base) throw new Error("NEXT_PUBLIC_API_BASE is not defined");
  return base;
}

export async function fetchMetrics(params: {
  tenantId: string;
  streamId?: string;
  agg?: "minute" | "hour" | "day";
  limit?: number;
}): Promise<z.infer<typeof metricsSchema>["items"]> {
  const url = new URL("/metrics", getApiBase());
  url.searchParams.set("tenantId", params.tenantId);
  if (params.streamId) url.searchParams.set("streamId", params.streamId);
  if (params.agg) url.searchParams.set("agg", params.agg);
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to load metrics: ${res.status}`);
  }

  const json = await res.json();
  return metricsSchema.parse(json).items;
}

export async function fetchAlerts(params: {
  tenantId: string;
  limit?: number;
}): Promise<z.infer<typeof alertsSchema>["items"]> {
  const url = new URL("/alerts", getApiBase());
  url.searchParams.set("tenantId", params.tenantId);
  if (params.limit) url.searchParams.set("limit", String(params.limit));

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to load alerts: ${res.status}`);
  }

  const json = await res.json();
  return alertsSchema.parse(json).items;
}

export async function acknowledgeAlert(params: { tenantId: string; alertId: string }): Promise<void> {
  const url = new URL(`/alerts/${params.alertId}/ack`, getApiBase());
  url.searchParams.set("tenantId", params.tenantId);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to acknowledge alert: ${res.status}`);
  }
}
