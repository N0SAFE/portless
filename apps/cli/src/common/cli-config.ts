import { DaemonClient } from "@portless/core";
import { loadConfig, resolveRuntime, type LoadedConfig } from "@portless/config";

export const CLI_NAME = "portless";
export const VERSION = "0.1.0";

/**
 * Shared configuration/daemon helpers for CLI commands.
 */
export interface CliContext {
  config: LoadedConfig;
  client: DaemonClient;
  runtime: ReturnType<typeof resolveRuntime>;
}

export async function buildCliContext(overrides: {
  tld?: string;
  tls?: boolean;
  lan?: boolean;
  wildcard?: boolean;
} = {}): Promise<CliContext> {
  const config = await loadConfig();
  const runtime = resolveRuntime(config.global, overrides);
  const client = new DaemonClient();
  return { config, client, runtime };
}

/** If the daemon is not running, print a friendly error (mirrors vercel portless non-interactive behaviour). */
export async function requireDaemon(client: DaemonClient): Promise<void> {
  const ok = await client.isReachable();
  if (!ok) {
    throw new Error(
      "portless daemon is not running. Start it with `portless daemon start` (or `portless proxy start`), " +
        "or run with privileged flags. In CI/non-interactive mode portless refuses to auto-start.",
    );
  }
}
