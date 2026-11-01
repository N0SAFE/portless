import { Command, CommandRunner } from "nest-commander";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";

/**
 * `portless plugins` — list registered providers/plugins (the pluggable model).
 */
@Command({ name: "plugins", description: "List registered providers/plugins" })
export class PluginsCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
  }

  async run(): Promise<void> {
    const client = await this.daemon.ensureDaemon();
    const providers = await client.listProviders();
    const items = providers.providers;
    ui.log("Registered providers:");
    if (items.length === 0) {
      ui.log("  (none)");
      return;
    }
    for (const p of items) {
      ui.log(`  ${p.id} [${p.kind}] ${p.enabled ? (p.available ? "available" : "enabled (not available)") : "disabled"} — ${p.description}`);
    }
  }
}
