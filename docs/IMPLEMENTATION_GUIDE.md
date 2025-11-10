# Guia de Implementação do app-cf-stream

Este guia descreve um passo a passo prático para levantar o aplicativo completo utilizando exclusivamente serviços da Cloudflare, seguindo as melhores práticas documentadas. Cada fase inclui objetivos, tarefas obrigatórias e validações antes de prosseguir.

## Fase 0 — Preparação do Ambiente
1. **Provisionar recursos Cloudflare**
   - Criar conta Cloudflare e habilitar Workers, Pages, D1 e R2.
   - Provisionar bucket R2 `app-cf-stream-raw` e base D1 `app_cf_stream`.
   - Criar namespace de Durable Object `RoomCoordinator` com migração inicial (`wrangler deploy --dry-run` executa migrations).
2. **Configurar Wrangler**
   - Instalar `wrangler` global (`npm install -g wrangler`).
   - Autenticar com `wrangler login`.
   - Atualizar `wrangler.toml` com `database_id` real e, se desejar, variáveis de ambiente adicionais.
3. **Preparar repositório**
   - Rodar `npm install` em `frontend/` e `worker/`.
   - Criar arquivo `.env.local` em `frontend/` com `NEXT_PUBLIC_WS_BASE=wss://<worker-host>/ws` e `NEXT_PUBLIC_API_BASE=https://<worker-host>`.

## Fase 1 — Backend edge-first
1. **Ingestão HTTP (`POST /ingest`)**
   - Validar tokens no edge (implementar validador em `worker/src/utils/auth.ts`).
   - Normalizar eventos com o schema `IngestEvent` (ver `worker/src/routes/ingest.ts`).
   - Persistir metadados em D1 (`events_recent`, `alerts`, `audit_logs`).
   - Persistir payload bruto em R2 com chave `tenantId/streamId/<timestamp>-<uuid>.json`.
   - Acionar Durable Object via `stub.fetch("/publish")` para fanout realtime.
   - Confirmar taxa média <10 ms CPU no Worker (usar `wrangler tail`).
2. **Durable Object `RoomCoordinator`**
   - Gerenciar conexões WebSocket por `tenantId:streamId`.
   - Agregar eventos em janelas de 1s usando `AggregateBuffer` (ver `worker/src/utils/aggregator.ts`).
   - Enviar apenas deltas compactados (JSON com campos relevantes) para cada cliente conectado.
   - Implementar degradação: se `buffer.length > MAX_BATCH_SIZE`, enviar payload `mode="aggregated"` e sinalizar para o frontend reduzir a fidelidade.
3. **APIs auxiliares**
   - `GET /health` retorna status de D1/R2/DO.
   - `GET /metrics` lê agregados recentes de D1 (usar filtros de tenant e janelas).
   - `GET /alerts` lista alertas ativos.
4. **Testes automáticos**
   - Executar `npm test` em `worker/` (Vitest + Miniflare) para validar ingestão, agregação e rate limit básico.
   - Adicionar testes para cenários com eventos malformados e tenants inválidos.

## Fase 2 — Frontend (Cloudflare Pages + Next.js)
1. **Estrutura base**
   - `npm run dev` em `frontend/` para validar build local.
   - Configurar `next.config.mjs` com `withCloudflare` (Next-on-Pages) para deploy.
   - Garantir que `app/(dashboard)/page.tsx` carregue dados iniciais via `fetch` (`NEXT_PUBLIC_API_BASE`).
2. **Realtime UI**
   - Usar `useRealtimeStream` (ver `frontend/hooks/use-realtime-stream.ts`) para conectar ao WebSocket.
   - Renderizar KPIs, gráficos (ex. via `@visx` ou WebGL) e feed usando os dados de `AggregateEnvelope`.
   - Implementar virtualização para tabelas (`react-virtualized` ou `@tanstack/react-virtual`).
   - Fornecer controles para mudar stream/tenant no componente `StreamSelector`.
3. **Alertas e automações**
   - Mostrar alertas em tempo real usando canal `alerts`.
   - Permitir ack/snooze com chamadas a `POST /alerts/<id>/ack` (implementar rota correspondente no Worker).
4. **Auditoria & multi-tenant**
   - Implementar troca de tenant via Access token.
   - Validar que UI filtra tudo por tenant selecionado.

## Fase 3 — Observabilidade e Resiliência
1. **Rate limiting e QoS**
   - Implementar quotas por tenant usando Durable Object de rate limit ou Cloudflare Rulesets.
   - Configurar modo de degradação (redução de fidelidade) e logs de incidente (`incident_logs` em D1).
2. **Monitoramento**
   - Configurar dashboards no Cloudflare Analytics (Workers, D1, R2).
   - Exportar logs críticos para R2 ou SIEM externo.
3. **CI/CD**
   - Integrar com GitHub: Pages automaticamente builda `frontend/`.
   - Usar GitHub Actions chamando `wrangler deploy` para backend com pre-check `npm test`.
4. **Backups e retenção**
   - Políticas de lifecycle no R2 (mover dados antigos para classe infrequente).
   - Jobs periódicos via Cron Triggers (Workers) para consolidar dados históricos em OLAP.

## Fase 4 — Extensões opcionais
- Implementar exportação de dados (Parquet) direto de R2.
- Integrar com Cloudflare Queues para desacoplar ingestão de pipeline OLAP.
- Adicionar Cloudflare Access para proteger rotas `/admin`.
- Suportar GraphQL Gateway via Workers se necessário.

## Checklist de Validação Final
- [ ] `npm test` passa em `worker/`.
- [ ] Deploy Pages concluído (`npm run build` + preview OK).
- [ ] `wrangler deploy` concluído com migrações aplicadas.
- [ ] Dashboard exibe KPIs <1s, feed realtime, alertas funcionando.
- [ ] Logs de auditoria aparecem em D1.
- [ ] Payloads brutos armazenados em R2.
- [ ] Modo de degradação validado (forçar backlog e observar fallback para agregados).

Seguindo essas etapas o aplicativo opera inteiramente na Cloudflare, com ingestão edge-first, fanout realtime, persistência econômico-performante e UI reativa capaz de lidar com alto volume de dados.
