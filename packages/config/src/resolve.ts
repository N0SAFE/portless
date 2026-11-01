import { buildHostname, type Route } from "@portless/core";
import { DEFAULT_TLD } from "@portless/core";
import type { AppEntry, GlobalConfig, ProjectConfig } from "./types.js";

/**
 * Resolve effective high-level decisions from global + project config, with
 * CLI flags and env vars applied last (done by the CLI layer). These helpers
 * centralize the precedence logic so daemon and CLI agree.
 */

export interface ResolvedRuntime {
  /** Effective TLD (overridden by PORTLESS_TLD or --tld, LAN -> .local). */
  tld: string;
  tls: boolean;
  proxyPort: number;
  lan: boolean;
  wildcard: boolean;
  syncHosts: boolean;
  defaultProvider: string;
}

export function resolveRuntime(
  global: GlobalConfig,
  overrides: Partial<
    Pick<ResolvedRuntime, "tld" | "tls" | "lan" | "wildcard" | "syncHosts"> & { port?: number }
  > = {},
): ResolvedRuntime {
  const envTld = process.env.PORTLESS_TLD;
  const portFromEnv = process.env.PORTLESS_PORT;
  const lanFromEnv = process.env.PORTLESS_LAN;

  const tld = overrides.tld ?? envTld?.split(",")[0] ?? global.tld ?? DEFAULT_TLD;
  const lan = overrides.lan ?? (lanFromEnv ? lanFromEnv !== "0" : global.lan);
  const tls = overrides.tls ?? (process.env.PORTLESS_HTTPS === "0" ? false : global.tls);

  const proxyPort =
    overrides.port ??
    (portFromEnv ? Number(portFromEnv) : undefined) ??
    global.port ??
    (tls ? 443 : 80);

  return {
    tld,
    tls,
    proxyPort,
    lan,
    wildcard: overrides.wildcard ?? global.wildcard,
    syncHosts: overrides.syncHosts ?? global.syncHosts,
    defaultProvider: global.defaultProvider,
  };
}

/**
 * Resolve the effective per-app entry, merging global-scope env + project env.
 * `appEntry` is the project's own entry; `apps` override can layer on top for
 * workspace packages.
 */
export interface ResolvedApp {
  name: string;
  script: string;
  appPort?: number;
  proxy: boolean;
  provider: string;
  compose?: AppEntry["compose"];
  env: Record<string, string>;
  /** Public URL host for the resolved app. */
  host: string;
}

export function resolveApp(
  global: GlobalConfig,
  project: ProjectConfig | undefined,
  runtime: ResolvedRuntime,
  opts: {
    projectName?: string;
    appEntry?: AppEntry;
    /** Explicit overrides from CLI. */
    name?: string;
    script?: string;
    appPort?: number;
    provider?: string;
    envProfile?: string;
  } = {},
): ResolvedApp {
  // Layered entry: project defaults + optional apps override + CLI overrides.
  const entry: AppEntry = {
    ...project,
    ...opts.appEntry,
  };
  const name =
    opts.name ?? entry.name ?? project?.name ?? opts.projectName ?? "app";
  const script = opts.script ?? entry.script ?? project?.script ?? "dev";
  const appPort = opts.appPort ?? entry.appPort ?? project?.appPort;
  const provider = opts.provider ?? entry.provider ?? project?.provider ?? runtime.defaultProvider;
  const proxy = entry.proxy ?? project?.proxy ?? true;

  // Environment: project env + selected profile (profile wins).
  const profile = opts.envProfile ? global.envProfiles?.[opts.envProfile] : undefined;
  const env = {
    ...(global.env ?? {}),
    ...(project?.env ?? {}),
    ...(entry.env ?? {}),
    ...(profile ?? {}),
  };

  const host = buildHostname({
    name,
    project: project?.name ? opts.projectName : undefined,
    tld: runtime.tld,
    lan: runtime.lan,
  });

  return {
    name,
    script,
    appPort,
    proxy,
    provider,
    compose: entry.compose ?? project?.compose,
    env,
    host,
  };
}

/** Build a Route object from a resolved app (used by CLIs before daemon call). */
export function appToRouteHint(host: string, port: number): Route {
  return {
    host,
    target: `127.0.0.1:${port}`,
    protocol: "http",
    source: "local",
    tls: true,
    createdAt: new Date().toISOString(),
  };
}
