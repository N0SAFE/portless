import { Injectable, Logger } from "@nestjs/common";
import {
  LocalCa,
  createProxyServer,
  type ProxyServerHandle,
  type TcpProxyHandle,
} from "@portless/core";
import { RoutesService } from "./routes.service.js";
import { EventsService } from "../events/events.service.js";

export interface ProxySettings {
  port: number;
  tls: boolean;
  lan: boolean;
  listenerHost?: string;
  wildcard: boolean;
  cert?: string;
  key?: string;
}

/**
 * Owns the reverse-proxy lifecycle (the portless proxy engine from core) and
 * wires its router to the route table. Also owns the local CA.
 */
@Injectable()
export class RuntimeService {
  private readonly logger = new Logger(RuntimeService.name);
  private proxy: ProxyServerHandle | undefined;
  private tcpProxy: TcpProxyHandle | undefined;
  private settings: ProxySettings | undefined;
  private readonly ca: LocalCa;

  constructor(
    private readonly routes: RoutesService,
    private readonly events: EventsService,
  ) {
    this.ca = new LocalCa(process.env.PORTLESS_STATE_DIR);
  }

  get caInstance(): LocalCa {
    return this.ca;
  }

  get running(): boolean {
    return this.proxy?.running ?? false;
  }

  get currentSettings(): ProxySettings | undefined {
    return this.settings;
  }

  async startProxy(settings: ProxySettings): Promise<void> {
    if (this.running) {
      throw new Error("proxy is already running; stop it first");
    }
    this.routes.setWildcard(settings.wildcard);
    this.settings = settings;

    if (settings.tls) await this.ca.ensureCa();

    const router = (host: string) => this.routes.resolve(host);
    const listenerHost = settings.listenerHost ?? (settings.lan ? "0.0.0.0" : "127.0.0.1");

    this.proxy = createProxyServer({
      port: settings.port,
      tls: settings.tls,
      ca: settings.tls ? this.ca : undefined,
      cert: settings.cert,
      key: settings.key,
      router,
      listenerHost,
    });
    await this.proxy.start();

    this.events.emit({
      type: "proxy.status",
      running: true,
      port: settings.port,
      tls: settings.tls,
    });
    this.logger.log(`proxy listening on ${listenerHost}:${settings.port} (tls=${settings.tls})`);
  }

  /**
   * Start the dockportless-style TCP/SNI listener for non-HTTP protocols.
   */
  async startTcpProxy(port: number, listenerHost = "127.0.0.1"): Promise<void> {
    if (this.tcpProxy?.running) return;
    // lazy import to avoid coupling when not needed
    const { createTcpProxy } = await import("@portless/core");
    this.tcpProxy = createTcpProxy({
      port,
      ca: this.ca,
      router: (host: string) => this.routes.resolve(host),
      listenerHost,
    });
    await this.tcpProxy.start();
    this.logger.log(`TCP/SNI proxy listening on ${listenerHost}:${port}`);
  }

  async stopProxy(): Promise<void> {
    await this.proxy?.stop();
    await this.tcpProxy?.stop();
    this.proxy = undefined;
    this.tcpProxy = undefined;
    this.events.emit({ type: "proxy.status", running: false });
    this.logger.log("proxy stopped");
  }
}
