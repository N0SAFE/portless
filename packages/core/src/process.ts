import { spawn, type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

export interface SpawnOptions {
  command: string;
  args: string[];
  cwd: string;
  env?: Record<string, string>;
  /** Resolve the executable through the shell (required for `pnpm`, `docker compose`, etc.). */
  shell?: boolean;
}

export interface Spawned {
  child: ChildProcess;
  /** @returns the exit code once the process exits (resolves null on signal). */
  exited: Promise<number | null>;
  /** Attach a line-based stdout/stderr logger. */
  onLine: (cb: (line: string, stream: "stdout" | "stderr") => void) => void;
  kill: (signal?: NodeJS.Signals) => void;
}

/**
 * Spawn a child process with line-based logging and lifecycle helpers.
 * Used by the process/docker/dockportless providers to supervise children.
 */
export function runCommand(opts: SpawnOptions): Spawned {
  const emitter = new EventEmitter();
  const child = opts.shell
    ? spawn([opts.command, ...opts.args].join(" "), {
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        shell: true,
        stdio: ["pipe", "pipe", "pipe"],
      })
    : spawn(opts.command, opts.args, {
        cwd: opts.cwd,
        env: { ...process.env, ...opts.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

  const exited = new Promise<number | null>((resolve) => {
    child.on("exit", (code) => resolve(code));
    child.on("error", () => resolve(null));
  });

  return {
    child,
    exited,
    onLine(cb) {
      if (child.stdout) {
        child.stdout.on("data", (d: Buffer) => {
          for (const line of d.toString().split("\n")) {
            if (line) cb(line, "stdout");
          }
        });
      }
      if (child.stderr) {
        child.stderr.on("data", (d: Buffer) => {
          for (const line of d.toString().split("\n")) {
            if (line) cb(line, "stderr");
          }
        });
      }
    },
    kill(signal = "SIGTERM") {
      child.kill(signal);
    },
  };
}
