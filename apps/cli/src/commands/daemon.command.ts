import { Command, CommandRunner } from "nest-commander";
import type { DaemonClient } from "@portless/core";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";

interface DaemonStatus {
  running: boolean;
  version?: string;
  proxy?: { running: boolean; port?: number; tls?: boolean };
}

/**
 * `portless daemon start|stop|status` — the daemon-managed control plane.
 *
 * This is the heart of the daemon-first model: the daemon owns every app,
 * route, cert, and config. `start` launches it (and keeps it running), `status`
 * reports health, `stop` shuts it down.
 */
@Command({ name: "daemon", description: "Control the portless daemon (start|stop|status)" })
export class DaemonCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
  }

  async run(passedParams: string[]): Promise<void> {
    const action = passedParams?.[0] ?? "status";

    if (action === "start") {
      const client = await this.daemon.ensureDaemon();
      ui.success("daemon running");
      ui.info(`control plane: ${client.baseUrl}`);
      return;
    }

    if (action === "stop") {
      await this.daemon.stopSpawned();
      ui.success("daemon stopped (if it was started by this CLI)");
      return;
    }

    // status
    const client = this.daemon.getClient();
    if (await client.isReachable()) {
      const h = await client.health();
      ui.data({ running: true, ...mapHealth(h) } satisfies DaemonStatus);
    } else {
      ui.data({ running: false } satisfies DaemonStatus);
      ui.info("daemon is not running — start it with `portless daemon start`");
    }
  }
}

function mapHealth(h: Awaited<ReturnType<DaemonClient["health"]>>): Partial<DaemonStatus> {
  return { version: h.version, proxy: h.proxy };
}
