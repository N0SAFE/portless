import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { mkdir } from "node:fs/promises";
import { portlessPaths } from "@portless/core";
import { DaemonModule } from "./app.module.js";
import { DaemonSettingsService } from "./settings/daemon-settings.service.js";
import { RuntimeService } from "./engine/runtime.service.js";

/**
 * portless daemon entrypoint.
 *
 * Boots the NestJS control-plane API on 127.0.0.1:<PORTLESS_DAEMON_PORT> and
 * starts the reverse proxy (control plane + proxy engine). CLI, dashboard and
 * agents interact via the control plane.
 */
export async function bootstrap(
  proxyOverrides: {
    port?: number;
    tls?: boolean;
    lan?: boolean;
    wildcard?: boolean;
    cert?: string;
    key?: string;
    startProxy?: boolean;
    tcpProxyPort?: number;
  } = {},
): Promise<{ app: Awaited<ReturnType<typeof NestFactory.create>>; close: () => Promise<void> }> {
  const logger = new Logger("PortlessDaemon");
  const paths = portlessPaths(process.env);
  await mkdir(paths.stateDir, { recursive: true });
  await mkdir(paths.daemonDir, { recursive: true });
  await mkdir(paths.logDir, { recursive: true });

  const app = await NestFactory.create(DaemonModule, {
    logger: process.env.PORTLESS_DAEMON_LOG === "debug" ? ["log", "warn", "error", "debug"] : ["log", "warn", "error"],
  });
  app.enableShutdownHooks();

  const settings = app.get(DaemonSettingsService);
  const runtime = app.get(RuntimeService);

  // Start the proxy unless explicitly disabled.
  if (proxyOverrides.startProxy !== false) {
    try {
      const proxySettings = await settings.proxySettings({
        port: proxyOverrides.port,
        tls: proxyOverrides.tls,
        lan: proxyOverrides.lan,
        wildcard: proxyOverrides.wildcard,
        cert: proxyOverrides.cert,
        key: proxyOverrides.key,
      });
      await runtime.startProxy(proxySettings);
      if (proxyOverrides.tcpProxyPort) {
        await runtime.startTcpProxy(proxyOverrides.tcpProxyPort);
      }
    } catch (err) {
      logger.error(`failed to start proxy: ${(err as Error).message}`);
      // If the proxy cannot bind (e.g. no sudo for 443), fall back to an
      // unprivileged proxy port and warn.
      if (err instanceof Error && String(err.message).includes("EACCES")) {
        logger.warn("port 443 requires elevated privileges; falling back to 8443");
        await runtime.startProxy({ ...(await settings.proxySettings()), port: 8443 });
      }
    }
  }

  const daemonPort = settings.daemonPort;
  await app.listen(daemonPort, "127.0.0.1");
  logger.log(`control plane listening on http://127.0.0.1:${daemonPort}`);

  const close = async () => {
    await runtime.stopProxy();
    await app.close();
  };
  return { app, close };
}

// Run only when executed directly (not when imported by tests).
const isMain =
  typeof import.meta !== "undefined" && "main" in import.meta
    ? Boolean((import.meta as unknown as { main: boolean }).main)
    : true;
if (isMain || process.env.PORTLESS_DAEMON_DIRECT === "1") {
  void bootstrap()
    .then(({ close }) => {
      process.on("SIGTERM", () => void close().then(() => process.exit(0)));
      process.on("SIGINT", () => void close().then(() => process.exit(0)));
    })
    .catch((err) => {
      console.error(`[portless-daemon] fatal: ${err.message}`);
      process.exit(1);
    });
}
