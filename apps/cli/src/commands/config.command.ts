import { Command, CommandRunner, Option } from "nest-commander";
import { promises as fs } from "node:fs";
import path from "node:path";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";

interface ConfigOptions {
  scope?: "global" | "project";
  json?: boolean;
}

/**
 * `portless config` — read/write the portless configuration (global or
 * per-project), including per-project environment (`env`).
 *
 *   portless config get --json
 *   portless config set env.MY_VAR=value --scope global|project
 *   portless config init
 */
@Command({ name: "config", description: "Read/write portless configuration (global or per-project)" })
export class ConfigCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
  }

  @Option({ flags: "--scope <scope>", description: "global | project" })
  parseScope(val: string): "global" | "project" {
    return val === "project" ? "project" : "global";
  }

  @Option({ flags: "-j, --json", description: "JSON output" })
  parseJson(val: boolean): boolean {
    return val;
  }

  async run(passedParams: string[], options?: ConfigOptions): Promise<void> {
    const [action, ...rest] = passedParams ?? [];
    if (action === "init") {
      await this.init();
      return;
    }
    if (action === "get") {
      await this.get(options);
      return;
    }
    if (action === "set") {
      await this.set(rest, options);
      return;
    }
    ui.error("usage: portless config get|set <path>=<value>|init [--scope global|project]");
    process.exitCode = 1;
  }

  private async get(options?: ConfigOptions): Promise<void> {
    const client = await this.daemon.ensureDaemon();
    const cfg = await client.getConfig();
    if (options?.json) {
      ui.data(cfg);
      return;
    }
    ui.log(`global: ${JSON.stringify(cfg.global, null, 2)}`);
    if (cfg.project) ui.log(`project (${cfg.projectDir ?? "cwd"}): ${JSON.stringify(cfg.project, null, 2)}`);
  }

  private async set(assignments: string[], options?: ConfigOptions): Promise<void> {
    const client = await this.daemon.ensureDaemon();
    const scope = options?.scope ?? "project";
    const patch: Record<string, unknown> = {};
    for (const assignment of assignments) {
      const eq = assignment.indexOf("=");
      if (eq < 0) {
        // bare key: read
        ui.error(`expected <path>=<value>, got "${assignment}"`);
        process.exitCode = 1;
        return;
      }
      const keyPath = assignment.slice(0, eq);
      const value = assignment.slice(eq + 1);
      setPath(patch, keyPath, coerce(value));
    }
    const res = await client.updateConfig(scope, patch);
    ui.success(`updated ${scope} config`);
    if (options?.json) ui.data(res.global);
  }

  private async init(): Promise<void> {
    const file = path.join(process.cwd(), "portless.json");
    const exists = await fs
      .access(file)
      .then(() => true)
      .catch(() => false);
    if (exists) {
      ui.warn(`${file} already exists`);
      return;
    }
    await fs.writeFile(file, JSON.stringify({ name: path.basename(process.cwd()), script: "dev" }, null, 2) + "\n", "utf8");
    ui.success(`created ${file}`);
  }
}

function coerce(value: string): unknown {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+$/.test(value)) return Number(value);
  return value;
}

function setPath(target: Record<string, unknown>, dotted: string, value: unknown): void {
  const parts = dotted.split(".");
  let cursor: Record<string, unknown> = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    cursor[key] = cursor[key] ?? {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}
