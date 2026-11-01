import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DaemonClient, portlessPaths } from "@portless/core";
import { ui } from "./ui.js";

/**
 * Locates, starts, and connects to the portless daemon.
 *
 * The CLI is a thin client: every command that needs state talks to the daemon
 * over the control plane. If the daemon is not running, we start it (unless in
 * CI/non-interactive mode) and wait for it to become healthy.
 */
export class DaemonService {
  private readonly client: DaemonClient;
  private spawnedPid: number | undefined;

  constructor() {
    this.client = new DaemonClient();
  }

  getClient(): DaemonClient {
    return this.client;
  }

  get isSpawned(): boolean {
    return this.spawnedPid !== undefined;
  }

  /** True if stdout is not a TTY or CI is set (non-interactive). */
  static get nonInteractive(): boolean {
    return Boolean(process.env.CI) || !process.stdout.isTTY;
  }

  /**
   * Resolve the daemon entrypoint path so `bun run <main>` can start it.
   * Searches the monorepo layout relative to this file.
   */
  private resolveDaemonMain(): string {
    if (process.env.PORTLESS_DAEMON_MAIN) return process.env.PORTLESS_DAEMON_MAIN;
    const here = path.dirname(fileURLToPath(import.meta.url));
    // apps/cli/src/common -> climb to repo root
    let dir = here;
    for (let i = 0; i < 6; i++) {
      const candidate = path.join(dir, "apps", "daemon", "src", "main.ts");
      if (existsSync(candidate)) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    throw new Error("unable to locate the portless daemon main; set PORTLESS_DAEMON_MAIN");
  }

  /**
   * Ensure the daemon is reachable, starting it if necessary. Returns the
   * connected client. In non-interactive mode with no daemon, throws.
   */
  async ensureDaemon(start = true): Promise<DaemonClient> {
    if (await this.client.isReachable()) return this.client;

    if (!start || DaemonService.nonInteractive) {
      throw new Error(
        "portless daemon is not running and cannot be auto-started here. " +
          "Run `portless daemon start` in an interactive terminal, or in CI invoke the daemon explicitly.",
      );
    }

    const main = this.resolveDaemonMain();
    ui.info(`starting portless daemon…`);
    const child = spawn("bun", ["run", main], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env },
    });
    child.unref();
    this.spawnedPid = child.pid;

    // Poll health until ready or timeout.
    const deadline = Date.now() + 10_000;
    for (;;) {
      if (await this.client.isReachable()) {
        ui.success("daemon ready");
        return this.client;
      }
      if (Date.now() > deadline) {
        throw new Error("daemon failed to become ready within 10s");
      }
      await sleep(200);
    }
  }

  /** Stop a daemon we spawned ourselves. */
  async stopSpawned(): Promise<void> {
    if (this.spawnedPid) {
      try {
        process.kill(this.spawnedPid, "SIGTERM");
      } catch {
        /* noop */
      }
      this.spawnedPid = undefined;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type { PortlessPaths } from "@portless/core";
export { portlessPaths };
