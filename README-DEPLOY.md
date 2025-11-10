# Deploy do app-cf-stream (Cloudflare-first)

Guia prático para deploy do stack proposto: Next.js (frontend), Cloudflare Workers, Durable Objects, D1, R2.

---

## 1. Pré-requisitos

- Conta Cloudflare (https://dash.cloudflare.com/)
- Node.js 18+
- `wrangler` CLI (`npm install -g wrangler`)
- GitHub/GitLab para CI/CD (opcional, mas recomendado)

---

## 2. Estrutura do projeto

```
app-cf-stream/
├── frontend/           # Next.js app
├── worker/             # Código dos Workers e Durable Objects
├── wrangler.toml       # Configuração dos Workers/DO/D1/R2
├── ARQUITETURA.md      # Diagrama de arquitetura
└── README.md           # Este guia
```

---

## 3. Setup local

### a) Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev
```

### b) Backend (Workers/DO)

```bash
cd worker
npm install
wrangler dev
```

> Use `wrangler dev --local` para simular DO/D1/R2 localmente (limitações existem, mas útil para testes rápidos).

---

## 4. Configuração do wrangler.toml (exemplo)

```toml
name = "app-cf-stream"
main = "src/index.ts"
type = "javascript"
compatibility_date = "2023-11-01"

[durable_objects]
bindings = [
  { name = "ROOM", class_name = "Room" }
]

[[migrations]]
new_classes = ["Room"]

[[d1_databases]]
binding = "DB"
database_name = "appcfstream"

[[r2_buckets]]
binding = "RAW"
bucket_name = "rawdata"
```

- Ajuste os nomes conforme seu projeto.
- Adicione secrets/envs via `wrangler secret put` ou dashboard Cloudflare.

---

## 5. Deploy para Cloudflare

### a) Deploy do frontend (Next.js)

- Configure Pages no dashboard Cloudflare, conectando ao seu repositório.
- Build command: `npm run build`
- Output directory: `out` (ou `.next` para SSR)
- Para rotas dinâmicas/SSR, use Pages Functions (ver docs Cloudflare Pages + Next.js).

### b) Deploy dos Workers/DO

```bash
cd worker
wrangler deploy
```

- O deploy publica Workers, Durable Objects, D1 e R2 bindings.
- Use `wrangler d1 execute` para rodar migrações SQL.

---

## 6. Troubleshooting & Dicas

- **Logs**: `wrangler tail` para logs em tempo real dos Workers.
- **DO State**: Use endpoints de debug para inspecionar estado dos Durable Objects.
- **D1**: Use o dashboard Cloudflare ou `wrangler d1` para queries e migrações.
- **R2**: Gerencie buckets/arquivos pelo dashboard ou API.
- **Permissões**: Garanta que tokens/API keys estejam corretos para deploy e acesso.
- **Limites**: Veja quotas de Workers, DO, D1 e R2 na [documentação Cloudflare](https://developers.cloudflare.com/).

---

## 7. Referências úteis

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)
- [Cloudflare Pages + Next.js](https://developers.cloudflare.com/pages/framework-guides/nextjs/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)

---

> Para dúvidas ou problemas, consulte os links acima ou abra uma issue no repositório.
