# Diagrama de Arquitetura — app-cf-stream

## Visão Geral (Texto)

O sistema é composto por:

- **Frontend (Next.js)**: Deploy em Cloudflare Pages, servindo UI estática e rotas dinâmicas via Pages Functions.
- **Cloudflare Workers**: Recebem ingestão de eventos, fazem autenticação, validação e fan-out para outros componentes.
- **Durable Objects**: Gerenciam canais WebSocket, coordenação de streams e broadcast de dados em tempo real.
- **D1 (SQL)**: Armazena metadados, índices, sessões e dados transacionais recentes.
- **R2 (Object Storage)**: Armazena payloads brutos, arquivos grandes e dados históricos.
- **OLAP externo (ClickHouse/BigQuery)**: Para análises históricas e queries massivas (opcional, integração via pipeline).

### Fluxos principais

1. **Ingestão**: Cliente envia eventos para Worker (`POST /ingest`). Worker valida, grava em R2, atualiza Durable Object e responde.
2. **Realtime**: Cliente conecta via WebSocket (`GET /ws?stream=...`). Worker roteia para Durable Object, que gerencia conexões e faz broadcast.
3. **Consulta**: Cliente faz requisições REST/SSR para métricas agregadas. Worker consulta D1/KV e retorna dados.
4. **Export/Analytics**: Dados brutos são exportados de R2 para OLAP externo para análises históricas.

---

## Diagrama SVG

```svg
<svg width="800" height="520" viewBox="0 0 800 520" xmlns="http://www.w3.org/2000/svg">
  <rect x="40" y="40" width="180" height="60" fill="#e3f2fd" stroke="#1976d2" rx="10"/>
  <text x="130" y="75" font-size="16" text-anchor="middle" fill="#1976d2">Cliente (Browser)</text>

  <rect x="260" y="40" width="180" height="60" fill="#fffde7" stroke="#fbc02d" rx="10"/>
  <text x="350" y="75" font-size="16" text-anchor="middle" fill="#fbc02d">Cloudflare Pages (Next.js)</text>

  <rect x="500" y="40" width="180" height="60" fill="#e8f5e9" stroke="#388e3c" rx="10"/>
  <text x="590" y="75" font-size="16" text-anchor="middle" fill="#388e3c">Cloudflare Workers</text>

  <rect x="500" y="140" width="180" height="60" fill="#f3e5f5" stroke="#8e24aa" rx="10"/>
  <text x="590" y="175" font-size="16" text-anchor="middle" fill="#8e24aa">Durable Objects</text>

  <rect x="260" y="240" width="180" height="60" fill="#e1f5fe" stroke="#0288d1" rx="10"/>
  <text x="350" y="275" font-size="16" text-anchor="middle" fill="#0288d1">D1 (SQL)</text>

  <rect x="500" y="240" width="180" height="60" fill="#fff3e0" stroke="#ef6c00" rx="10"/>
  <text x="590" y="275" font-size="16" text-anchor="middle" fill="#ef6c00">R2 (Object Storage)</text>

  <rect x="350" y="400" width="180" height="60" fill="#ede7f6" stroke="#5e35b1" rx="10"/>
  <text x="440" y="435" font-size="16" text-anchor="middle" fill="#5e35b1">OLAP Externo</text>

  <!-- Setas -->
  <line x1="220" y1="70" x2="260" y2="70" stroke="#1976d2" stroke-width="2" marker-end="url(#arrow)"/>
  <line x1="440" y1="70" x2="500" y2="70" stroke="#fbc02d" stroke-width="2" marker-end="url(#arrow)"/>
  <line x1="590" y1="100" x2="590" y2="140" stroke="#388e3c" stroke-width="2" marker-end="url(#arrow)"/>
  <line x1="590" y1="200" x2="590" y2="240" stroke="#8e24aa" stroke-width="2" marker-end="url(#arrow)"/>
  <line x1="590" y1="200" x2="350" y2="240" stroke="#8e24aa" stroke-width="2" marker-end="url(#arrow)"/>
  <line x1="590" y1="200" x2="680" y2="240" stroke="#8e24aa" stroke-width="2" marker-end="url(#arrow)"/>
  <line x1="590" y1="300" x2="440" y2="400" stroke="#ef6c00" stroke-width="2" marker-end="url(#arrow)"/>
  <line x1="350" y1="300" x2="440" y2="400" stroke="#0288d1" stroke-width="2" marker-end="url(#arrow)"/>

  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L10,5 L0,10 L2,5 Z" fill="#333" />
    </marker>
  </defs>
</svg>
```

---

**Legenda:**
- Setas indicam fluxo de dados (ingestão, realtime, storage, analytics).
- OLAP externo é opcional, mas recomendado para grandes volumes históricos.

---

> Para editar o SVG, basta copiar o bloco acima para um editor de SVG ou ferramenta online (ex: draw.io, Excalidraw, VS Code SVG Preview).
