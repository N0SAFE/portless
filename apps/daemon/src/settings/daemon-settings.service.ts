import { Injectable } from "@nestjs/common";
import { loadConfig, resolveRuntime } from "@portless/config";
import type { ProxySettings } from "../engine/runtime.service.js";

/**
 * Resolves effective daemon/proxy settings from global config + environment.
 * The CLI can pass explicit overrides via env vars when starting the daemon.
 */
@Injectable()
export class DaemonSettingsService {
  async proxySettings(overrides: {
    port?: number;
    tls?: boolean;
    lan?: boolean;
    wildcard?: boolean;
    cert?: string;
    key?: string;
  } = {}): Promise<ProxySettings> {
    const { global } = await loadConfig();
    const runtime = resolveRuntime(global, {
      tld: undefined,
      tls: overrides.tls,
      lan: overrides.lan,
      wildcard: overrides.wildcard,
    });
    // Provider default: if defaultProvider is docker/dockportless, the proxy
    // port is 7355 (dockportless convention); otherwise 443/80.
    const providerPort =
      global.defaultProvider === "docker" || global.defaultProvider === "dockportless"
        ? 7355
        : undefined;
    return {
      port: overrides.port ?? runtime.proxyPort ?? providerPort ?? 443,
      tls: overrides.tls ?? runtime.tls,
      lan: overrides.lan ?? runtime.lan,
      wildcard: overrides.wildcard ?? runtime.wildcard,
      cert: overrides.cert ?? process.env.PORTLESS_CERT,
      key: overrides.key ?? process.env.PORTLESS_KEY,
    };
  }

  get daemonPort(): number {
    return Number(process.env.PORTLESS_DAEMON_PORT) || 4711;
  }
}
