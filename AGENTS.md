# AGENTS.md — Portless

Guidance for coding agents working in this repo.

## What this is

A local development runtime + reverse proxy that maps stable named `.localhost`
URLs to dev servers/containers. **Daemon-first**: a long-running daemon owns
routes, apps, certs, and config; the CLI, dashboard, and agents talk to it over a
local HTTP API. It mirrors the command surface of `vercel-labs/portless` and
supports `mazrean/dockportless` integration, Docker Compose, per-project/global
config, and a pluggable provider model.

## Monorepo layout & dependency rules

```
apps/
  cli/          NestJS + nest-commander CLI (the `portless` binary)
  daemon/       NestJS control-plane API + reverse proxy engine
  dashboard/    Next.js dashboard over the control plane
packages/
  config/       config schema/discovery/precedence + per-project env
  contracts/    shared control-plane API types
  core/         protocol types, daemon client, proxy engine, CA, store
  providers/    pluggable providers: process, docker, dockportless
  configs/      shared eslint / prettier / ts / vitest configs
```

Dependency direction (do not violate):

```
config -> core
contracts -> core
core -> (nothing app-specific)
providers -> core, config
daemon -> core, contracts, providers
cli -> core, contracts, config
dashboard -> contracts, core
```

`core` must stay dependency-free of apps. `providers` depends only on `core` and
`config`. Composition lives in the apps.

## Package naming & wiring

- Packages are `@portless/*` (new) or `@repo/config-*` (kept shared configs).
- Workspace packages are linked via bun workspaces (`apps/**`, `packages/**`).
- **Add catalogs in the root `package.json`** (`workspaces.catalogs`) — packages
  refer to shared deps with `catalog:<key>` (e.g. NestJS = `catalog:api:nest`,
  commander/picocolors/prompts/zod = `catalog:utils`). Do not pin versions in leaf
  packages when a catalog exists.
- Leaf `package.json` files export `.ts` source directly (bun runs TS natively).

## Command surface (keep compatible)

The CLI must stay a superset of `vercel-labs/portless`:

`run`, `portless <name> <cmd>`, `alias`, `list`/`ls`, `doctor`, `trust`, `clean`,
`prune`, `hosts sync|clean`, `proxy start|stop`, `service install|status|uninstall`.
Our additions: `daemon start|stop|status`, `dev`, `config get|set|init`,
`plugins`, `init`.

Reserved words (cannot be bare app names): `run`, `get`, `alias`, `hosts`, `list`,
`ls`, `doctor`, `trust`, `clean`, `prune`, `proxy`, `service`, `config`, `login`,
`logout`, `dev`, `up`, `down`, `plugins`, `init`.

Children get injected: `PORT`, `HOST`, `PORTLESS_URL`, `PORTLESS_PROJECT`.

## Conventions

- **TypeScript strict**, `tsc --noEmit` (`bun run type-check`) must pass for every
  package and app. The `turbo` aggregate is `turbo type-check`.
- **Do not use `baseUrl`** in tsconfig (removed in TS 5.9). Use relative `./`
  `paths` entries.
- **zod v4**: `z.record` requires `(keySchema, valueSchema)`; `z.record(x)` is invalid.
- **NestJS**: decorate services with `@Injectable()`; the root CLI `@Command` requires
  `name` (use `name: "portless"` with `arguments: "[args...]"`).
- Use `node:fs/promises` for async file I/O; `node:fs` readFile is callback-based.
- Keep `core` and `contracts` free of framework imports (NestJS/Next).
- stdout = machine-readable data, stderr = human UI/logging.

## Common tasks

```bash
bun install                  # install workspace deps (frozen: --frozen-lockfile)
bun run dev:daemon           # run the daemon (control plane + proxy)
bun run dev:cli              # run the CLI
bun run dev:dashboard        # run the dashboard
bun run type-check           # tsc across all 11 packages/apps
bun run test                 # vitest across the repo
bun run lint                 # eslint
bun run format               # prettier
```

## When adding a feature

1. If it crosses packages, update `ARCHITECTURE.md` and the relevant package README.
2. Keep the command surface compatible with `vercel-labs/portless`.
3. Add catalog entries to the root `package.json`, not hard versions in leaves.
4. Wire realtime updates through the daemon's `EventsService` (SSE) so the dashboard
   and `portless dev` reflect changes.
5. Ensure `bun run type-check` passes before finishing.
