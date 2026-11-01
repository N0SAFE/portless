import { Command, CommandRunner } from "nest-commander";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";

/**
 * `portless trust` — install the portless local CA into the system trust store.
 */
@Command({ name: "trust", description: "Add local CA to system trust store" })
export class TrustCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
  }

  async run(): Promise<void> {
    const client = await this.daemon.ensureDaemon();
    ui.info("installing portless CA into the system trust store…");
    ui.warn("this may prompt for administrator (sudo) credentials");
    const result = await client.trust();
    if (result.trustStoreOk) {
      ui.success(`CA trusted at ${result.caPath}`);
    } else if (result.trustStoreAttempted) {
      ui.error("trust installation failed (may need sudo). Retry with elevated privileges.");
    } else {
      ui.success("CA is in place");
    }
  }
}
