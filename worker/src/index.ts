import { Router } from "itty-router";
import { error, json } from "itty-router-extras";
import type { ExecutionContext } from "@cloudflare/workers-types";
import type { Env } from "./env.js";
import { registerIngestRoutes } from "./routes/ingest.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerMetricsRoutes } from "./routes/metrics.js";
import { registerAlertRoutes } from "./routes/alerts.js";
import { registerWebsocketRoute } from "./routes/websocket.js";
export { RoomCoordinator } from "./do/room-coordinator.js";

const router = Router();

registerHealthRoutes(router);
registerIngestRoutes(router);
registerMetricsRoutes(router);
registerAlertRoutes(router);
registerWebsocketRoute(router);

router.all("*", () => json({ error: "Not Found" }, { status: 404 }));

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return router.handle(request, env, ctx).catch((err: unknown) => {
      if (err instanceof Response) return err;
      return error(err as Error);
    });
  },
};
