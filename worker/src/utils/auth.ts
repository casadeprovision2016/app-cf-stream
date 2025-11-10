import type { Env } from "../env.js";

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

interface CacheEntry {
  tenantId: string;
  scopes: string[];
  expiresAt: number;
}

const TOKEN_TTL_MS = 60_000;
const tokenCache = new Map<string, CacheEntry>();

export interface AuthContext {
  tenantId: string;
  scopes: string[];
}

export async function authenticate(request: Request, env: Env): Promise<AuthContext> {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) throw new UnauthorizedError();

  const token = header.slice(7).trim();
  if (!token) throw new UnauthorizedError();

  const cached = tokenCache.get(token);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return { tenantId: cached.tenantId, scopes: cached.scopes };
  }

  const record = await env.DB
    .prepare("SELECT tenant_id, scopes FROM api_tokens WHERE token = ?1 AND revoked_at IS NULL")
    .bind(token)
    .first<{ tenant_id: string; scopes: string | null }>();

  if (!record) throw new UnauthorizedError();

  const scopes = record.scopes ? JSON.parse(record.scopes) : [];
  const entry: CacheEntry = {
    tenantId: record.tenant_id,
    scopes,
    expiresAt: now + TOKEN_TTL_MS,
  };

  tokenCache.set(token, entry);
  return { tenantId: entry.tenantId, scopes: entry.scopes };
}

export function requireScope(ctx: AuthContext, scope: string) {
  if (!ctx.scopes.includes(scope)) {
    throw new UnauthorizedError("Insufficient scope");
  }
}
