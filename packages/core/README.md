# @portless/core

Shared core for the portless runtime: protocol types, the daemon client, the
reverse-proxy engine, local-CA helpers, path/port utilities, and a JSON store.

> Keep this package free of framework imports (no NestJS, no Next).

## Includes

- **Types** (`types.ts`) — `Route`, `AppRecord`, `Provider`/`ProviderInfo`,
  `DaemonEvent`, reserved command names, zod validation schemas.
- **Daemon client** (`client.ts`) — typed HTTP + SSE client for the control plane.
- **Proxy engine** (`proxy/proxy-server.ts`) — HTTP(S) reverse proxy (Host/SNI
  routing, WebSocket upgrade) plus a dockportless-style TCP/SNI listener.
- **Local CA** (`ca.ts`) — self-signed CA + per-host cert issuance (openssl-backed).
- **Paths / ports** (`paths.ts`, `ports.ts`) — state-dir resolution, URL building,
  free-port allocation.
- **Store** (`store.ts`) — dependency-free JSON file store.
- **Process runner** (`process.ts`) — spawn/supervise children with line logging.
- **Registry** (`registry.ts`) — pluggable provider registry.
