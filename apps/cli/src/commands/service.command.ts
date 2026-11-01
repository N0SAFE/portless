import { Command, CommandRunner, Option } from "nest-commander";
import { promises as fs } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { portlessPaths } from "@portless/core";
import { ui } from "../common/ui.js";

const execFileAsync = promisify(execFile);

interface ServiceOptions {
  lan?: boolean;
  wildcard?: boolean;
  tls?: boolean;
  port?: number;
}

/**
 * `portless service install|status|uninstall` — run the portless daemon (and
 * proxy) as an OS startup service so clean HTTPS URLs survive reboots.
 *
 * Linux: a systemd **user** unit that launches the daemon binary. (macOS
 * launchd and Windows Task Scheduler are stubbed with clear messages.)
 */
@Command({ name: "service", description: "Install/status/uninstall an OS startup service" })
export class ServiceCommand extends CommandRunner {
  @Option({ flags: "--lan", description: "Install in LAN mode" })
  parseLan(val: boolean): boolean {
    return val;
  }

  @Option({ flags: "--wildcard", description: "Persist wildcard routing" })
  parseWildcard(val: boolean): boolean {
    return val;
  }

  @Option({ flags: "--port <port>", description: "Proxy port for the service" })
  parsePort(val: string): number {
    return Number(val);
  }

  @Option({ flags: "--no-tls", description: "Disable HTTPS" })
  parseNoTls(val: boolean): boolean {
    return val;
  }

  private unitName = "portless.service";

  async run(passedParams: string[], options?: ServiceOptions): Promise<void> {
    const action = passedParams?.[0] ?? "status";
    if (action === "install") return this.install(options);
    if (action === "status") return this.status();
    if (action === "uninstall") return this.uninstall();
    ui.error("usage: portless service install|status|uninstall");
    process.exitCode = 1;
  }

  private async daemonMain(): Promise<string> {
    const env = process.env.PORTLESS_DAEMON_MAIN;
    if (env) return env;
    // Locate relative to the CLI common dir.
    const here = path.dirname(new URL(import.meta.url).pathname);
    let dir = here;
    for (let i = 0; i < 6; i++) {
      const c = path.join(dir, "apps", "daemon", "src", "main.ts");
      try {
        await fs.access(c);
        return c;
      } catch {
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
    throw new Error("cannot locate daemon main; set PORTLESS_DAEMON_MAIN");
  }

  private async install(options?: ServiceOptions): Promise<void> {
    if (process.platform !== "linux") {
      ui.error("service install currently supports systemd (Linux only). macOS/WSL support is planned.");
      process.exitCode = 1;
      return;
    }
    const main = await this.daemonMain();
    const paths = portlessPaths(process.env);
    const userUnitDir = path.join(homedir(), ".config", "systemd", "user");
    await fs.mkdir(userUnitDir, { recursive: true });

    const env: string[] = [];
    if (options?.lan) env.push("PORTLESS_LAN=1");
    if (options?.wildcard) env.push("PORTLESS_WILDCARD=1");
    if (options?.port) env.push(`PORTLESS_PORT=${options.port}`);
    if (options?.tls === false) env.push("PORTLESS_HTTPS=0");

    const unit = [
      "[Unit]",
      "Description=Portless daemon & proxy",
      "After=network.target",
      "",
      "[Service]",
      "Type=simple",
      `ExecStart=bun run ${main}`,
      `Environment=PORTLESS_STATE_DIR=${paths.stateDir}`,
      ...env.map((e) => `Environment=${e}`),
      "Restart=on-failure",
      "",
      "[Install]",
      "WantedBy=default.target",
      "",
    ].join("\n");

    await fs.writeFile(path.join(userUnitDir, this.unitName), unit, "utf8");
    await execFileAsync("systemctl", ["--user", "daemon-reload"]);
    await execFileAsync("systemctl", ["--user", "enable", "--now", "portless.service"]);
    ui.success("portless service installed and started (systemd user unit)");
    ui.info("independent of the terminal; the daemon/proxy now survive reboots");
  }

  private async status(): Promise<void> {
    if (process.platform !== "linux") {
      ui.info("service: not applicable on this platform");
      return;
    }
    try {
      const { stdout } = await execFileAsync("systemctl", ["--user", "is-active", "portless.service"]);
      ui.log(`portless service: ${stdout.trim()}`);
    } catch {
      ui.log("portless service: not installed");
    }
  }

  private async uninstall(): Promise<void> {
    if (process.platform !== "linux") return;
    try {
      await execFileAsync("systemctl", ["--user", "disable", "--now", "portless.service"]).catch(() => undefined);
      const userUnitDir = path.join(homedir(), ".config", "systemd", "user");
      await fs.rm(path.join(userUnitDir, this.unitName), { force: true }).catch(() => undefined);
      await execFileAsync("systemctl", ["--user", "daemon-reload"]).catch(() => undefined);
      ui.success("portless service uninstalled");
    } catch {
      ui.warn("could not fully uninstall service");
    }
  }
}
