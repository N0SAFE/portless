# @portless/providers

Pluggable launch/routing strategies for the portless engine. Implementing a
`Provider` and registering it is how you extend portless without touching core.

## Built-in providers

| Provider | Kind | What it does |
| --- | --- | --- |
| `process` | process | Spawn a local command through the proxy, inject `PORT`/`HOST`/`PORTLESS_URL`. Mirrors `vercel-labs/portless run`. |
| `docker` | compose | Parse `compose.yml`, assign each service a port, set `<SERVICE>_PORT`, run `docker compose up`, route `<service>.<project>.localhost`. |
| `dockportless` | external | Shell out to the `dockportless` binary for compose auto-port assignment + TLS-SNI routing. |

## Authoring a provider

```ts
import { ProviderRegistry } from "@portless/core";

class MyProvider implements Provider {
  readonly info = { id: "mine", kind: "process", name: "Mine", description: "…", enabled: true, available: true };
  async detect() { return true; }
  async start(req) { /* launch + return { app } */ }
  async stop({ id }) { /* stop */ }
  async list() { return []; }
}

registry.register(new MyProvider());
```

Provider config (enable/disable, binary override) lives in the global config
under `providers.<id>`. `buildDefaultProviders(global)` respects `enabled: false`.
