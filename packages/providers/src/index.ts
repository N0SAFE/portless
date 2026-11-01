import { ProviderRegistry } from "@portless/core";
import type { Provider } from "@portless/core";
import type { GlobalConfig } from "@portless/config";
import { ProcessProvider } from "./process-provider.js";
import { DockerProvider } from "./docker-provider.js";
import { DockportlessProvider } from "./dockportless-provider.js";

export * from "./process-provider.js";
export * from "./docker-provider.js";
export * from "./dockportless-provider.js";

/**
 * Build the default list of providers, honoring the global config's
 * `providers.*.enabled` flags. Disabled providers are excluded entirely; the
 * composition point for the daemon.
 */
export function buildDefaultProviders(global: GlobalConfig): Provider[] {
  const providers: Provider[] = [new ProcessProvider(), new DockerProvider(), new DockportlessProvider()];
  return providers.filter((p) => {
    const cfg = global.providers?.[p.info.id];
    return cfg?.enabled !== false;
  });
}

export function buildDefaultRegistry(global: GlobalConfig): ProviderRegistry {
  const registry = new ProviderRegistry();
  for (const p of buildDefaultProviders(global)) registry.register(p);
  return registry;
}
