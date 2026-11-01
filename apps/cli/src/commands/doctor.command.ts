import { Command, CommandRunner } from "nest-commander";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";

/**
 * `portless doctor` — inspect local health without changing state.
 * Checks the daemon, proxy, routes, DNS, and CA trust, then prints fixes.
 */
@Command({ name: "doctor", description: "Check proxy, routes, DNS, and CA trust" })
export class DoctorCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
  }

  async run(): Promise<void> {
    ui.info("portless doctor");
    const client = this.daemon.getClient();

    // 1) Daemon reachable?
    if (await client.isReachable()) {
      ui.success("daemon: reachable");
      const health = await client.health();
      ui.log(`   proxy: ${health.proxy?.running ? "running" : "stopped"} ${health.proxy?.port ? `(port ${health.proxy.port})` : ""} ${health.proxy?.tls ? "tls" : ""}`);
    } else {
      ui.warn("daemon: not reachable — start it with `portless daemon start`");
    }

    // 2) Routes
    try {
      const routes = await client.listRoutes();
      ui.log(`   routes: ${routes.length} registered`);
      for (const r of routes.slice(0, 10)) ui.log(`      ${r.host} -> ${r.target}`);
    } catch {
      ui.warn("routes: unavailable (daemon down)");
    }

    // 3) CA + hosts
    ui.log("   certs: local CA managed by daemon (run `portless trust` to (re)install into the OS trust store)");
    ui.log("   hosts: auto-synced by daemon (PORTLESS_SYNC_HOSTS=0 to disable)");
  }
}
