import { json } from "itty-router-extras";
import type { Env } from "../env.js";

export function registerHealthRoutes(router: any) {
  router.get("/health", async (_request: Request, env: Env) => {
    const checks: Record<string, string> = {};

    try {
      await env.DB.prepare("SELECT 1").first();
      checks.database = "ok";
    } catch (error) {
      checks.database = `error:${(error as Error).message}`;
    }

    try {
      await env.RAW.head("health-check");
      checks.storage = "ok";
    } catch {
      checks.storage = "uninitialized";
    }

    return json({ status: "ok", checks });
  });
}
