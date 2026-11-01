import { Command, CommandRunner, Option } from "nest-commander";
import { resolveApp } from "@portless/config";
import { buildCliContext } from "../common/cli-config.js";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";
import { projectName } from "./run.command.js";

interface DevOptions {
  name?: string;
  provider?: string;
}

/**
 * `portless dev` — daemon-managed development: start an app through the daemon
 * and stream its lifecycle events live (the same feed the dashboard consumes).
 * Ctrl+C stops the app.
 */
@Command({ name: "dev", description: "Daemon-managed dev: start an app and stream live events" })
export class DevCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
  }

  @Option({ flags: "-n, --name <name>", description: "App name" })
  parseName(val: string): string {
    return val;
  }

  @Option({ flags: "--provider <provider>", description: "Provider: process | docker | dockportless" })
  parseProvider(val: string): string {
    return val;
  }

  async run(passedParams: string[], options?: DevOptions): Promise<void> {
    const ctx = await buildCliContext();
    const name = options?.name ?? projectName(ctx.config.packageJson) ?? "app";
    const resolved = resolveApp(ctx.config.global, ctx.config.project, ctx.runtime, {
      projectName: name,
      name: options?.name,
      provider: options?.provider,
    });

    const client = await this.daemon.ensureDaemon();
    const cmd = passedParams ?? [];
    const commandStr = cmd.length > 0 ? cmd.join(" ") : resolved.script;

    ui.info(`starting ${resolved.name} through the daemon…`);
    const { app } = await client.startApp({
      name: resolved.name,
      command: commandStr,
      cwd: process.cwd(),
      host: resolved.host,
      port: resolved.appPort,
      tls: resolved.proxy ? ctx.runtime.tls : false,
      tld: ctx.runtime.tld,
      options: { provider: resolved.provider, env: resolved.env, file: resolved.compose?.file },
    });
    ui.success(`started ${app.name}`);
    ui.log(`   ${ui.url(app.url)}`);
    ui.info("streaming daemon events… (Ctrl+C to stop)");

    const unsub = client.subscribe((event) => {
      ui.log(`   [${event.type}]`);
    });

    const cleanup = async () => {
      unsub();
      await client.stopApp(app.id).catch(() => undefined);
      await this.daemon.stopSpawned().catch(() => undefined);
      process.exit(0);
    };
    process.once("SIGINT", () => void cleanup());
    process.once("SIGTERM", () => void cleanup());
  }
}
