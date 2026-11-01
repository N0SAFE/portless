import { Command, CommandRunner } from "nest-commander";
import { promises as fs } from "node:fs";
import { portlessPaths } from "@portless/core";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";

/**
 * `portless clean` — remove state, CA trust entry, and hosts block.
 * Resets the daemon store without touching the running proxy's children.
 */
@Command({ name: "clean", description: "Remove state, CA trust entry, and hosts block" })
export class CleanCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
  }

  async run(): Promise<void> {
    const paths = portlessPaths(process.env);
    // Stop any daemon we spawned.
    await this.daemon.stopSpawned().catch(() => undefined);

    // Remove hosts block via the daemon if it is reachable.
    try {
      const client = this.daemon.getClient();
      if (await client.isReachable()) {
        await fetch(`${client.baseUrl}/api/v1/hosts/clean`, { method: "POST" }).catch(() => undefined);
      }
    } catch {
      /* noop */
    }

    let removed = 0;
    for (const [label, file] of [
      ["state dir", paths.stateDir],
      ["daemon dir", paths.daemonDir],
    ] as const) {
      try {
        await fs.rm(file, { recursive: true, force: true });
        removed++;
        ui.log(`   removed ${label} ${file}`);
      } catch {
        /* noop */
      }
    }
    ui.success(`cleaned ${removed} portless path(s)`);
    ui.info("custom CA is retained so a later `portless clean` can retry trust-store removal safely");
  }
}
