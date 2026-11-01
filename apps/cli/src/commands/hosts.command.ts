import { Command, CommandRunner } from "nest-commander";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";

/**
 * `portless hosts sync|clean` — manage the /etc/hosts block.
 */
@Command({ name: "hosts", description: "Manage /etc/hosts entries for routes" })
export class HostsCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
    // sub commands
  }

  async run(passedParams: string[]): Promise<void> {
    const client = await this.daemon.ensureDaemon();
    const action = passedParams?.[0];
    const base = client.baseUrl;
    if (action === "sync") {
      const res = await fetch(`${base}/api/v1/hosts/sync`, { method: "POST" }).then((r) => r.json() as Promise<{ synced: number }>);
      ui.success(`synced ${res.synced} host entries to /etc/hosts`);
      return;
    }
    if (action === "clean") {
      await fetch(`${base}/api/v1/hosts/clean`, { method: "POST" });
      ui.success("removed portless entries from /etc/hosts");
      return;
    }
    ui.error("usage: portless hosts sync|clean");
    process.exitCode = 1;
  }
}
