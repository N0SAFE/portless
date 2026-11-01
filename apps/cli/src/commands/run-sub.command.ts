import { Command, CommandRunner, Option } from "nest-commander";
import { resolveApp } from "@portless/config";
import { buildCliContext } from "../common/cli-config.js";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";
import { projectName } from "./run.command.js";

interface RunSubOptions {
  name?: string;
  script?: string;
  appPort?: number;
  provider?: string;
  env?: string;
  noTls?: boolean;
}

/**
 * `portless run [--name <name>] [cmd...]` — infer the app name from the
 * project and run the given command (or the "dev" script) through the proxy.
 */
@Command({
  name: "run",
  arguments: "[cmd...]",
  description: "Infer app name, run a command/script through the proxy",
})
export class RunSubCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
  }

  @Option({ flags: "-n, --name <name>", description: "App name (default: inferred from project)" })
  parseName(val: string): string {
    return val;
  }

  @Option({ flags: "-s, --script <script>", description: "package.json script (default: dev)" })
  parseScript(val: string): string {
    return val;
  }

  @Option({ flags: "--app-port <port>", description: "Fixed app port" })
  parseAppPort(val: string): number {
    return Number(val);
  }

  @Option({ flags: "--provider <provider>", description: "Provider: process | docker | dockportless" })
  parseProvider(val: string): string {
    return val;
  }

  @Option({ flags: "--no-tls", description: "Disable HTTPS" })
  parseNoTls(val: boolean): boolean {
    return val;
  }

  async run(passedParams: string[], options?: RunSubOptions): Promise<void> {
    const ctx = await buildCliContext({ tls: options?.noTls ? false : undefined });
    const inferred = options?.name ?? projectName(ctx.config.packageJson) ?? "app";
    const resolved = resolveApp(ctx.config.global, ctx.config.project, ctx.runtime, {
      projectName: inferred,
      name: options?.name,
      script: options?.script,
      appPort: options?.appPort,
      provider: options?.provider,
    });
    const client = await this.daemon.ensureDaemon();
    const cmd = passedParams ?? [];
    const commandStr = cmd.length > 0 ? cmd.join(" ") : resolved.script;
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
  }
}
