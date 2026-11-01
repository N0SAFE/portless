import { Command, CommandRunner, Option } from "nest-commander";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";

interface ListOptions {
  json?: boolean;
}

/**
 * `portless list` (alias `ls`) — show active routes. Machine-readable JSON with
 * `--json`, table on stdout otherwise.
 */
@Command({ name: "list", aliases: ["ls"], description: "Show active routes" })
export class ListCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
  }

  @Option({ flags: "-j, --json", description: "Machine-readable JSON output" })
  parseJson(val: boolean): boolean {
    return val;
  }

  async run(_passedParams: string[], options?: ListOptions): Promise<void> {
    const client = await this.daemon.ensureDaemon();
    const routes = await client.listRoutes();

    if (options?.json) {
      process.stdout.write(`${JSON.stringify(routes, null, 2)}\n`);
      return;
    }

    ui.data(
      routes.map((r) => ({
        host: r.host,
        target: r.target,
        source: r.source,
        tls: r.tls,
        app: r.app?.status,
      })),
    );
  }
}
