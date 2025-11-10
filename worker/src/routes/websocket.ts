import type { Env } from "../env.js";
import { authenticate, UnauthorizedError } from "../utils/auth.js";

export function registerWebsocketRoute(router: any) {
  router.get("/ws", async (request: Request, env: Env) => {
    if (request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("Expected WebSocket", { status: 426, headers: { Upgrade: "websocket" } });
    }

    let auth;
    try {
      auth = await authenticate(request, env);
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        return new Response("Unauthorized", { status: 401 });
      }
      throw error;
    }
    const url = new URL(request.url);
    const streamId = url.searchParams.get("streamId");
    const topic = url.searchParams.get("topic") ?? "metrics";
    const tenantId = url.searchParams.get("tenantId") ?? auth.tenantId;

    if (!streamId) {
      return new Response("Missing streamId", { status: 400 });
    }

    if (tenantId !== auth.tenantId) {
      return new Response("Tenant mismatch", { status: 403 });
    }

    const roomId = env.ROOM_COORDINATOR.idFromName(`${tenantId}:${streamId}:${topic}`);
    const stub = env.ROOM_COORDINATOR.get(roomId);

  const headers = new Headers(request.headers);
  headers.delete("Authorization");
    headers.set("X-Tenant-Id", tenantId);
    headers.set("X-Stream-Id", streamId);
    headers.set("X-Topic", topic);

    const forward = new Request(`https://room-coordinator/ws`, {
      method: "GET",
      headers,
    });

    return stub.fetch(forward);
  });
}
