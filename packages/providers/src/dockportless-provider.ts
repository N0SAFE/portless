import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  buildUrl,
  runCommand,
  type AppRecord,
  type Provider,
  type StartAppRequest,
  type StartAppResult,
} from "@portless/core";

const execFileAsync = promisify(execFile);

/**
 * The `dockportless` provider — integrates `mazrean/dockportless`.
 *
 * dockportless is a Zig single-binary that does compose-compatible automatic
 * port assignment + TLS-SNI routing on its own proxy (default :7355). This
 * provider shells out to it the way the real tool expects:
 *
 *   dockportless run <project> <command...>
 *
 * and mirrors each service into the portless daemon as routes with source
 * "dockportless", so they are visible from `portless list` and the dashboard
 * and reachable via our own named URLs.
 */
export class DockportlessProvider implements Provider {
  readonly info = {
    id: "dockportless",
    kind: "external" as const,
    name: "dockportless",
    description: "TLS-SNI routing & compose auto-port assignment via the dockportless binary",
    enabled: true,
    available: false,
    proxyPort: 7355,
  };

  private readonly running = new Map<string, AppRecord>();

  async detect(): Promise<boolean> {
    try {
      await execFileAsync("dockportless", ["--version"], { timeout: 3000 });
      this.info.available = true;
      return true;
    } catch {
      this.info.available = false;
      return false;
    }
  }

  async start(request: StartAppRequest): Promise<StartAppResult> {
    const id = randomUUID();
    const binary = (request.options?.binary as string | undefined) ?? "dockportless";
    const project = (request.options?.project as string | undefined) ?? request.name;
    const proxyPort = (request.options?.proxyPort as number | undefined) ?? 7355;

    // Parse command into dockportless run <project> <command...>
    const parts = request.command.trim().split(/\s+/);
    const command = parts[0] ?? "";
    const args = [
      "run",
      project,
      ...(parts.length > 1 ? [command, ...parts.slice(1)] : ["docker", "compose", "up"]),
    ];

    const spawned = runCommand({
      command: binary,
      args,
      cwd: request.cwd,
      env: (request.options?.env as Record<string, string> | undefined) ?? {},
      shell: false,
    });

    const app: AppRecord = {
      id,
      name: request.name,
      command: `${binary} ${args.join(" ")}`,
      cwd: request.cwd,
      status: "starting",
      pid: spawned.child.pid,
      provider: "dockportless",
      url: buildUrl({ host: request.host, tls: request.tls, port: proxyPort }),
      env: {},
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
    return { app, env: {} };
  }

  async stop(request: { id: string }): Promise<void> {
    const app = this.running.get(request.id);
    if (app?.pid) {
      try {
        process.kill(app.pid, "SIGTERM");
      } catch {
        /* noop */
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
