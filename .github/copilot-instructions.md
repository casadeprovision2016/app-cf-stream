# app-cf-stream AI Guide
## Architecture Snapshot
- Cloudflare-first realtime dashboard; preserve edge-first flows described in README.md.
- Worker handles HTTP ingest → Durable Object per tenant → D1 hot metadata + R2 raw blobs → optional OLAP export (ARQUITETURA.md).
- Web clients connect via Pages-hosted Next.js UI; prefer WebGL/canvas for heavy charts and virtualized tables.
- Keep DOs sharded by tenant/stream and send binary deltas (Protobuf/CBOR) instead of full payloads.
## Key Source References
- README.md gives product scope, feature inventory, and performance/security expectations.
- ARQUITETURA.md diagrams ingest/realtime/export flows; mirror those when adding services.
- README-DEPLOY.md documents repo layout (frontend/, worker/, wrangler.toml) and Cloudflare deploy pipeline.
- Use wrangler.toml for all bindings (Durable Objects, D1, R2); never hardcode env secrets in code.
## Development Workflow
- Frontend: run npm scripts inside frontend/ (npm install, npm run dev, npm run build) targeting Pages.
- Workers: develop under worker/ with npm install and wrangler dev; use wrangler dev --local to emulate D1/R2 when possible.
- Deploy via wrangler deploy for Workers/DO and Pages CI for frontend; sync migrations with wrangler d1 execute.
- Tail logs using wrangler tail; prefer local debug endpoints in DOs instead of ad-hoc console logs in production.
## Coding Conventions
- Implement ingest handlers that validate auth at the edge, enforce rate limiting, and immediately fan out to DO + storage.
- Aggregate events into 1s/5s windows before broadcasting; store only hot aggregates in D1 and push raw payloads to R2.
- Prefer binary wire formats (Protobuf/CBOR) and delta updates for WebSocket payloads; gzip only if payloads exceed limits.
- Cache hot queries in Workers KV or CDN cache with short TTLs; invalidate on DO-side writes to avoid stale dashboards.
## Testing & Observability
- Add synthetic tests that assert auth guards, rate limits, and DO sharding behaviour; simulate multi-tenant load when possible.
- Use wrangler tail and Cloudflare analytics to verify latency targets; log audit events to D1 per README.md guidance.
- Ensure ingest pipelines degrade gracefully (switch to aggregated mode) under backpressure and record incidents.
- Document new endpoints with expected 202/stream semantics so Pages Functions and Workers stay consistent.
