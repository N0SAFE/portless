import { Command, CommandRunner, Option } from "nest-commander";
import { DaemonService } from "../common/daemon.service.js";
import { ui } from "../common/ui.js";

interface ProxyOptions {
  noTls?: boolean;
  lan?: boolean;
  port?: number;
  wildcard?: boolean;
  tcpProxy?: number;
}

/**
 * `portless proxy start|stop` — control the reverse proxy (daemon-managed).
 */
@Command({ name: "proxy", description: "Start/stop the HTTPS proxy (daemon)" })
export class ProxyCommand extends CommandRunner {
  constructor(private readonly daemon: DaemonService) {
    super();
  }

  @Option({ flags: "--no-tls", description: "Disable HTTPS" })
  parseNoTls(val: boolean): boolean {
    return val;
  }

  @Option({ flags: "--lan", description: "LAN mode" })
  parseLan(val: boolean): boolean {
    return val;
  }

  @Option({ flags: "-p, --port <port>", description: "Proxy port" })
  parsePort(val: string): number {
    return Number(val);
  }

  @Option({ flags: "--wildcard", description: "Allow unregistered subdomains to fall back to parent" })
  parseWildcard(val: boolean): boolean {
    return val;
  }

  @Option({ flags: "--tcp-proxy <port>", description: "Also start dockportless-style TCP/SNI listener" })
  parseTcpProxy(val: string): number {
    return Number(val);
  }

  async run(passedParams: string[], options?: ProxyOptions): Promise<void> {
    const action = passedParams?.[0] ?? "start";
    const client = await this.daemon.ensureDaemon();
    if (action === "start") {
      const res = await client.proxyStart({
        port: options?.port,
        tls: options?.noTls ? false : undefined,
        lan: options?.lan,
        wildcard: options?.wildcard,
        tcpProxyPort: options?.tcpProxy,
      });
      ui.success(`proxy ${res.ok ? "started" : "not started"}${res.port ? ` on port ${res.port}` : ""}${res.tls !== false ? " (tls)" : ""}`);
      return;
    }
    if (action === "stop") {
      await client.proxyStop();
      ui.success("proxy stopped");
      return;
    }
    ui.error("usage: portless proxy start|stop");
    process.exitCode = 1;
  }
}
