import { Body, Controller, HttpException, HttpStatus, Post } from "@nestjs/common";
import { RuntimeService } from "../engine/runtime.service.js";
import { DaemonSettingsService } from "../settings/daemon-settings.service.js";

export interface ProxyStartRequest {
  port?: number;
  tls?: boolean;
  lan?: boolean;
  wildcard?: boolean;
  cert?: string;
  key?: string;
  tcpProxyPort?: number;
}

@Controller("api/v1/proxy")
export class ProxyController {
  constructor(
    private readonly runtime: RuntimeService,
    private readonly settings: DaemonSettingsService,
  ) {}

  @Post("start")
  async start(@Body() body: ProxyStartRequest = {}) {
    const settings = await this.settings.proxySettings({
      port: body.port,
      tls: body.tls,
      lan: body.lan,
      wildcard: body.wildcard,
      cert: body.cert,
      key: body.key,
    });
    try {
      await this.runtime.startProxy(settings);
      if (body.tcpProxyPort) await this.runtime.startTcpProxy(body.tcpProxyPort);
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.CONFLICT);
    }
    return { ok: true, port: settings.port, tls: settings.tls };
  }

  @Post("stop")
  async stop() {
    await this.runtime.stopProxy();
    return { ok: true };
  }
}
