# @portless/daemon

The portless **control plane + reverse proxy engine** (NestJS). One long-running
process owns every route, app, cert, and config. The CLI, dashboard, and agents
interact via the control-plane HTTP API.

## What runs

- **Control plane** — REST JSON API on `127.0.0.1:<PORTLESS_DAEMON_PORT>` (default
  `4711`) for routes, apps, projects, hosts, config, plugins, certs, and a live
  SSE event stream.
- **Reverse proxy** — routed by `Host` (HTTP/1.1) and SNI (HTTP/2), with WebSocket
  upgrade and per-host certs from the local CA. Optionally a dockportless-style
  TCP/SNI listener for non-HTTP protocols.

## Start

```bash
bun run src/main.ts          # boot control plane + proxy
```

## Structure

```
src/
  engine/        routes.service, apps.service, runtime.service (proxy lifecycle)
  controllers/   health, routes, apps, projects, hosts, config, plugins, certs,
                 events (SSE), proxy
  events/        events.service (in-process bus -> SSE)
  hosts/ hosts.service        /etc/hosts block management
  certs/ certs.service        local CA status + OS trust
  config/ config.service      global/project config read + deep-merge update
  settings/      daemon + proxy settings resolution
```

The daemon is usually started via `portless daemon start` (the CLI spawns it) or
as a Docker container (`docker compose up -d daemon`).
