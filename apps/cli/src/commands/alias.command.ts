import { Command, CommandRunner, Option } from "nest-commander";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";

interface AliasOptions {
  remove?: boolean;
  force?: boolean;
  name?: string;
}

/**
 * `portless alias <name> <port> [--force]` — register a static route.
 * `portless alias --remove <name>` — remove a static route.
 *
 * Useful for Docker / external services that already bind a port.
 */
@Command({
  name: "alias",
  arguments: "[name] [port]",
  description: "Register/remove a static route (e.g. for Docker)",
})
export class AliasCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
  }

  @Option({ flags: "--remove", description: "Remove the named route" })
  parseRemove(val: boolean): boolean {
    return val;
  }

  @Option({ flags: "-f, --force", description: "Overwrite an existing route" })
  parseForce(val: boolean): boolean {
    return val;
  }

  async run(passedParams: string[], options?: AliasOptions): Promise<void> {
    const [nameArg, portArg] = passedParams ?? [];
    const name = options?.name ?? nameArg;
    const client = await this.daemon.ensureDaemon();

    if (options?.remove) {
      if (!name) {
        ui.error("alias --remove requires a name");
        process.exitCode = 1;
        return;
      }
      const res = await client.removeRoute(name);
      ui.success(res.removed ? `removed route ${name}` : `no route for ${name}`);
      return;
    }

    if (!name || !portArg) {
      ui.error("usage: portless alias <name> <port> [--force]");
      process.exitCode = 1;
      return;
    }
    const port = Number(portArg);
    if (Number.isNaN(port)) {
      ui.error(`invalid port: ${portArg}`);
      process.exitCode = 1;
      return;
    }
    const route = await client.addAlias({ host: `${name}.localhost`, target: `127.0.0.1:${port}`, force: options?.force });
    ui.success(`aliased ${route.host} -> ${route.target}`);
  }
}
