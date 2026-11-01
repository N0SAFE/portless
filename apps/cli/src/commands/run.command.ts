import { Command, CommandRunner, Option } from "nest-commander";
import { resolveApp } from "@portless/config";
import { RESERVED_NAMES } from "@portless/core";
import { buildCliContext } from "../common/cli-config.js";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";

interface RunOptions {
  name?: string;
  script?: string;
  appPort?: number;
  provider?: string;
  env?: string;
  noTls?: boolean;
  lan?: boolean;
  tld?: string;
  force?: boolean;
  tailscale?: boolean;
  ngrok?: boolean;
}

/**
 * The root `portless` program command (no name -> nest-commander treats it as
 * the root). Handles:
 *
 *   portless                        -> run the "dev" script through the proxy
 *   portless <name> <cmd...>        -> run app at https://<name>.localhost
 *
 * `portless run ...` is a separate subcommand (RunSubcommand). Reserved words
 * are excluded so they never get captured as an app name.
 */
@Command({
  name: "portless",
  arguments: "[args...]",
  description:
    "Run a dev server through the portless proxy (https://<name>.localhost)",
})
export class RunCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
  }

  @Option({ flags: "-n, --name <name>", description: "App name" })
  parseName(val: string): string {
    return val;
  }

  @Option({ flags: "-s, --script <script>", description: "package.json script (default: dev)" })
  parseScript(val: string): string {
    return val;
  }

  @Option({ flags: "--provider <provider>", description: "Provider: process | docker | dockportless" })
  parseProvider(val: string): string {
    return val;
  }

  @Option({ flags: "--env <profile>", description: "Named env profile from global config" })
  parseEnv(val: string): string {
    return val;
  }

  @Option({ flags: "--app-port <port>", description: "Fixed app port (skip auto-assignment)" })
  parseAppPort(val: string): number {
    return Number(val);
  }

  @Option({ flags: "--no-tls", description: "Disable HTTPS" })
  parseNoTls(val: boolean): boolean {
    return val;
  }

  @Option({ flags: "--lan", description: "LAN mode" })
  parseLan(val: boolean): boolean {
    return val;
  }

  @Option({ flags: "--tld <tld>", description: "Custom TLD (default: localhost)" })
  parseTld(val: string): string {
    return val;
  }

  @Option({ flags: "--force", description: "Kill existing process and take over its route" })
  parseForce(val: boolean): boolean {
    return val;
  }

  @Option({ flags: "--tailscale", description: "Share on Tailscale (tailnet)" })
  parseTailscale(val: boolean): boolean {
    return val;
  }

  @Option({ flags: "--ngrok", description: "Share publicly via ngrok" })
  parseNgrok(val: boolean): boolean {
    return val;
  }

  async run(passedParams: string[], options?: RunOptions): Promise<void> {
    const args = (passedParams ?? []) as string[];

    // Bare `portless` — run the dev script.
    if (args.length === 0 && !options?.name) {
      await this.runDevScript(options);
      return;
    }

    // `portless <name> <cmd...>` — first non-reserved arg is the app name.
    const name = options?.name ?? args[0] ?? "";
    if (!name) {
      ui.error("no app name provided");
      process.exitCode = 1;
      return;
    }
    if (RESERVED_NAMES.has(name)) {
      ui.error(`"${name}" is a reserved command name; use \`portless run --name ${name}\` to run it as an app`);
      process.exitCode = 1;
      return;
    }
    const cmd = args.slice(options?.name ? 0 : 1);
    await this.startApp(name, cmd, options);
  }

  private async runDevScript(options?: RunOptions): Promise<void> {
    const ctx = await buildCliContext(options);
    const name = projectName(ctx.config.packageJson) ?? "app";
    const resolved = resolveApp(ctx.config.global, ctx.config.project, optionsToRuntime(ctx, options), {
      projectName: name,
      name,
      script: options?.script,
      appPort: options?.appPort,
      provider: options?.provider,
      envProfile: options?.env,
    });
    const client = await this.daemon.ensureDaemon();
    const { app } = await client.startApp({
      name: resolved.name,
      command: resolved.script,
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

  private async startApp(name: string, cmd: string[], options?: RunOptions): Promise<void> {
    const ctx = await buildCliContext(options);
    const resolved = resolveApp(ctx.config.global, ctx.config.project, ctx.runtime, {
      projectName: name,
      name,
      script: options?.script,
      appPort: options?.appPort,
      provider: options?.provider,
      envProfile: options?.env,
    });
    const client = await this.daemon.ensureDaemon();
    const commandStr = cmd.length > 0 ? cmd.join(" ") : resolved.script;
    const { app } = await client.startApp({
      name: resolved.name,
      command: commandStr,
      cwd: process.cwd(),
      host: resolved.host,
      port: resolved.appPort,
      tls: resolved.proxy ? ctx.runtime.tls : false,
      tld: ctx.runtime.tld,
      options: {
        provider: options?.provider ?? resolved.provider,
        env: resolved.env,
        file: resolved.compose?.file,
      },
    });
    ui.success(`started ${app.name}`);
    ui.log(`   ${ui.url(app.url)}`);
  }
}

export function projectName(packageJson?: Record<string, unknown> | undefined): string | undefined {
  if (!packageJson?.name) return undefined;
  const n = String(packageJson.name);
  return n.startsWith("@") && n.includes("/") ? n.split("/").slice(1).join("/") : n;
}

function optionsToRuntime(ctx: Awaited<ReturnType<typeof buildCliContext>>, options?: RunOptions) {
  return {
    ...ctx.runtime,
    tld: options?.tld ?? ctx.runtime.tld,
    lan: options?.lan ?? ctx.runtime.lan,
    tls: options?.noTls ? false : ctx.runtime.tls,
  };
}
