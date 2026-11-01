import { Command, CommandRunner } from "nest-commander";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";

/**
 * `portless prune` — reconcile the daemon's app/route table with reality,
 * removing orphaned/stopped apps (e.g. from crashed sessions).
 */
@Command({ name: "prune", description: "Kill orphaned dev servers from crashed sessions" })
export class PruneCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
  }

  async run(): Promise<void> {
    const client = await this.daemon.ensureDaemon();
    const apps = await client.listApps();
    const stale = apps.filter((a) => a.status === "exited" || a.status === "error");
    for (const app of stale) {
      await client.stopApp(app.id).catch(() => undefined);
      ui.log(`   pruned ${app.name}`);
    }
    ui.success(`pruned ${stale.length} orphaned app(s)`);
  }
}
