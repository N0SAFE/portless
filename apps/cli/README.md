# @portless/cli

The `portless` binary — a **NestJS + nest-commander** CLI mirroring the command
surface of `vercel-labs/portless`, plus daemon-management and configuration
commands. It is a thin client over the daemon control plane.

## Commands

```
portless                                     Run dev script through the proxy
portless run [--name <name>] [cmd...]        Infer name, run through the proxy
portless <name> <cmd...>                     Run app at https://<name>.localhost
portless alias <name> <port> [--force]       Register a static route
portless alias --remove <name>               Remove a static route
portless dev                                 Daemon-managed dev + live events
portless list | ls                           Show active routes
portless doctor                              Health diagnostics
portless trust                               Install local CA into trust store
portless clean                               Remove state, CA trust, hosts block
portless prune                               Reconcile orphaned apps
portless hosts sync|clean                    Manage /etc/hosts
portless proxy start|stop                    Start/stop the proxy
portless daemon start|stop|status            Control the daemon
portless service install|status|uninstall    OS startup service
portless config get|set|init                 Global & per-project config
portless plugins                             List providers/plugins
portless init                                Scaffold a portless.json
```

## Build / run

```bash
bun run dev         # watch mode
bun run build       # compile dist/portless.js
bun run scripts/build.ts
```

Structure: `main.ts` + `app.module.ts`, `common/` (ui, daemon service, cli
config), `commands/` (one class per command). Add a command by creating a class
and registering it in `CommandsModule`.
