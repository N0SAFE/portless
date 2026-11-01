# @portless/config

Portless configuration: global + per-project schema, discovery, loading,
precedence resolution, and per-project environment.

## Sources (low → high precedence)

1. Compiled defaults (`defaults.ts`)
2. Global config — `~/.portless/config.json` (`PORTLESS_STATE_DIR` overrides)
3. Project config — `portless.json` or `package.json#portless` (nearest found by
   walking up from cwd)
4. `PORTLESS_*` environment variables
5. CLI flags

## Key exports

- `loadConfig()` — load global + project config and discover package.json.
- `resolveRuntime(global, overrides)` — effective TLD/TLS/port/LAN/wildcard.
- `resolveApp(global, project, runtime, opts)` — effective per-app entry, env
  (global → project → app → env profile), provider, and public host.
- `discoverWorkspace(dir)` — find workspace packages from `pnpm-workspace.yaml`
  or `package.json#workspaces`.

## Per-project env

```jsonc
{
  "name": "myapp",
  "env": { "MYAPP_MODE": "dev" }
}
```

Named profiles (global): `"envProfiles": { "dev": { "LOG_LEVEL": "debug" } }`,
selected with `portless run --env dev`.
