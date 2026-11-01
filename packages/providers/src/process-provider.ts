import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  allocateFreePort,
  buildChildEnv,
  buildUrl,
  runCommand,
  type AppRecord,
  type Provider,
  type StartAppRequest,
  type StartAppResult,
} from "@portless/core";

/**
 * The `process` provider — mirrors vercel-labs/portless `run`.
 *
 * Spawns an arbitrary command (typically a package script or a full command
 * line like `next dev`) as a supervised child, assigns it a free port, injects
 * the standard env (`PORT`, `HOST`, `PORTLESS_URL`, …), and registers the app.
 */
export class ProcessProvider implements Provider {
  readonly info = {
    id: "process",
    kind: "process" as const,
    name: "Local process",
    description: "Spawn a local command/server and route it through the proxy",
    enabled: true,
    available: true,
  };

  private readonly running = new Map<string, AppRecord>();

  async detect(): Promise<boolean> {
    return true;
  }

  async start(request: StartAppRequest): Promise<StartAppResult> {
    const port = request.port ?? (await allocateFreePort());
    const id = randomUUID();

    const env = buildChildEnv({
      port,
      host: request.host,
      tls: request.tls,
      extra: undefined,
      project: request.options?.project as string | undefined,
    });

    const parsed = parseCommand(request.command);
    const spawned = runCommand({
      command: parsed.command,
      args: parsed.args,
      cwd: request.cwd,
      env,
      shell: parsed.shell,
    });

    const app: AppRecord = {
      id,
      name: request.name,
      command: request.command,
      cwd: request.cwd,
      status: "starting",
      pid: spawned.child.pid,
      port,
      provider: "process",
      url: buildUrl({ host: request.host, tls: request.tls }),
      env,
      startedAt: new Date().toISOString(),
    };

    void spawned.exited.then((code) => {
      const cur = this.running.get(id);
      if (cur) {
        cur.status = code === 0 ? "exited" : "error";
        cur.stoppedAt = new Date().toISOString();
        cur.pid = undefined;
      }
    });

    this.running.set(id, app);
    app.status = "running";
    return { app, env };
  }

  async stop(request: { id: string }): Promise<void> {
    const app = this.running.get(request.id);
    if (app?.pid) {
      try {
        process.kill(app.pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    }
    if (app) {
      app.status = "stopped";
      app.stoppedAt = new Date().toISOString();
      app.pid = undefined;
    }
    this.running.delete(request.id);
  }

  async list(): Promise<AppRecord[]> {
    return [...this.running.values()];
  }
}

interface ParsedCommand {
  command: string;
  args: string[];
  /** If the first token is a shell-aliased/global command, delegate to shell. */
  shell: boolean;
}

function parseCommand(cmd: string): ParsedCommand {
  const trimmed = cmd.trim();
  const tokens = trimmed.split(/\s+/);
  const first = tokens[0] ?? "";
  // Commands that need a shell (scripts via pnpm/yarn/npm, globals, pipes, &&).
  const needsShell = /(^|\s)(&&|\|\||;|\||>|<)/.test(trimmed);
  if (needsShell) return { command: trimmed, args: [], shell: true };
  return { command: first, args: tokens.slice(1), shell: false };
}
