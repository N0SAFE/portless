# Portless

> Replace port numbers with stable, named `.localhost` URLs for local development —
> for humans **and** agents. Now **daemon-first**, with a **dashboard**, a pluggable
> provider model, per-project/global configuration, and Docker Compose support.

```diff
- "dev": "next dev"                # http://localhost:3000
+ "dev": "portless run next dev"   # https://myapp.localhost
```

Portless is a **local development runtime and reverse proxy**. A long-running
**daemon** owns every running app, route, certificate, and configuration. The
**CLI**, the **dashboard**, and **AI agents** all talk to the daemon over a local
HTTP API — so no more "CLI connected to nothing".

---

## Features

- **Daemon-first** — one long-running daemon (control plane + proxy engine) owns all
  routes, apps, certs, and config.
- **Dashboard** — a Next.js UI (routes, apps, providers) with a live SSE event stream.
- **`vercel-labs/portless`-compatible CLI** — `run`, `portless <name> <cmd>`, `alias`,
  `list`, `doctor`, `trust`, `clean`, `prune`, `hosts sync|clean`, `proxy start|stop`,
  `service install|status|uninstall`, plus `PORTLESS_*` env vars and the injected
  `PORT`/`HOST`/`PORTLESS_URL` children.
- **`mazrean/dockportless` support** — a `dockportless` provider shells out to the
  dockportless binary for compose auto-port assignment + TLS-SNI routing; a `docker`
  provider does it natively (parses `compose.yml`, sets `<SERVICE>_PORT`, routes
  `<service>.<project>.localhost`).
- **Per-project & global config** — `~/.portless/config.json` (global) and
  `portless.json` / `package.json#portless` (per project), including per-project env
  and named env profiles.
- **Pluggable** — a `Provider` interface; adding launch/routing strategy is a matter of
  implementing it and registering it.
- **Runs anywhere** — bare command servers *and* containerized via `docker compose`.

---

## Quick start

```bash
bun install
bun run dev:daemon     # start the daemon (control plane + proxy)
bun run dev:cli        # the portless CLI

# In a project with a "dev" script:
portless               # -> https://<project>.localhost
portless myapp next dev
portless run --name docs next dev
```

### Dashboard

```bash
bun run dev:dashboard  # http://localhost:3000
```

Or run the whole stack (daemon + dashboard) with Docker:

```bash
docker compose up --build -d
# dashboard   -> http://localhost:3000
# control API -> http://127.0.0.1:4711/api/v1/health
```

---

## CLI reference

```
portless                                     Run dev script through the proxy
portless run [--name <name>] [cmd...]        Infer name, run through the proxy
portless <name> <cmd...>                     Run app at https://<name>.localhost
portless alias <name> <port> [--force]       Register a static route (e.g. Docker)
portless alias --remove <name>               Remove a static route
portless dev                                 Daemon-managed dev + live event stream
portless list | ls                           Show active routes
portless doctor                              Check proxy, routes, DNS, CA trust
portless trust                               Add local CA to system trust store
portless clean                               Remove state, CA trust, hosts block
portless prune                               Kill orphaned dev servers
portless hosts sync|clean                    Manage /etc/hosts entries
portless proxy start|stop                    Start/stop the proxy (daemon)
portless daemon start|stop|status            Control the daemon
portless service install|status|uninstall    Run daemon as an OS startup service
portless config get|set|init                 Global & per-project config
portless plugins                             List registered providers/plugins
portless init                                Scaffold a portless.json
```

### Options & environment

`-p/--port`, `--no-tls`, `--lan`, `--tld`, `--wildcard`, `--name`, `--script`,
`--app-port`, `--provider`, `--force`, `--env <profile>`.

`PORTLESS_STATE_DIR`, `PORTLESS_DAEMON_PORT`, `PORTLESS_DAEMON_URL`,
`PORTLESS_PORT`, `PORTLESS_HTTPS`, `PORTLESS_TLD`, `PORTLESS_LAN`,
`PORTLESS_WILDCARD`, `PORTLESS_SYNC_HOSTS`, `PORTLESS_DEFAULT_PROVIDER`.

Children receive: `PORT`, `HOST`, `PORTLESS_URL`, `PORTLESS_PROJECT`.

---

## Configuration

**Global** — `~/.portless/config.json`:

```jsonc
{
  "tld": "localhost",
  "tls": true,
  "port": 443,
  "lan": false,
  "wildcard": false,
  "daemonPort": 4711,
  "defaultProvider": "process",
  "providers": {
    "process":      { "enabled": true },
    "docker":       { "enabled": true, "bin": "docker compose" },
    "dockportless": { "enabled": true, "bin": "dockportless" }
  },
  "env": { "NODE_ENV": "development" }
}
```

**Per-project** — `portless.json` (or `package.json#portless`):

```jsonc
{
  "name": "myapp",
  "script": "dev",
  "provider": "process",
  "env": { "MYAPP_MODE": "dev" },
  "apps": { "apps/web": { "name": "web" } }
}
```

Precedence (low → high): defaults &#8592; global config &#8592; project config
&#8592; `PORTLESS_*` env &#8592; CLI flags.

---

## Monorepo layout

```text
apps/
  cli/          # the `portless` binary — NestJS + nest-commander
  daemon/       # control-plane API + reverse proxy engine — NestJS
  dashboard/    # Next.js dashboard over the control plane
packages/
  config/       # config schemas, discovery, precedence, per-project env
  contracts/    # shared control-plane API types
  core/         # protocol types, daemon client, proxy engine, CA, store
  providers/    # pluggable providers: process, docker, dockportless
  configs/      # shared lint / ts / prettier / vitest configs
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design.

## Development

```bash
bun install
bun run dev:daemon
bun run dev:cli
bun run dev:dashboard
bun run type-check   # tsc across all packages
bun run test
bun run lint
```

## License

MIT
