import { z } from "zod";

/**
 * Core protocol types shared across the portless monorepo.
 *
 * These types are the contract between the CLI, the daemon, the dashboard,
 * and the providers. They must remain dependency-free (no NestJS, no Next).
 */

/* ------------------------------------------------------------------ */
/* Constants                                                          */
/* ------------------------------------------------------------------ */

export const PORTLESS_STATE_DIR_DEFAULT = "~/.portless";
export const PORTLESS_DAEMON_PORT_DEFAULT = 4711;
export const PORTLESS_PROXY_PORT_DEFAULT = 443;
export const PORTLESS_PROXY_PORT_NO_TLS_DEFAULT = 80;
export const PORTLESS_PROXY_PORT_DOCKER_DEFAULT = 7355;
export const PORTLESS_PORT_MIN = 4000;
export const PORTLESS_PORT_MAX = 4999;

/**
 * Command names that are reserved and cannot be used as bare app names.
 * Mirrors vercel-labs/portless plus our additions.
 */
export const RESERVED_NAMES = new Set([
  "run",
  "get",
  "alias",
  "hosts",
  "list",
  "ls",
  "doctor",
  "trust",
  "clean",
  "prune",
  "proxy",
  "service",
  "config",
  "login",
  "logout",
  "dev",
  "up",
  "down",
  "plugins",
  "init",
  "help",
  "--help",
  "--version",
  "-v",
  "-h",
]);

export const DEFAULT_TLD = "localhost";
export const LAN_TLD = "local";

/* ------------------------------------------------------------------ */
/* Provider / plugin protocol                                         */
/* ------------------------------------------------------------------ */

export type ProviderKind = "process" | "compose" | "external";

export interface ProviderInfo {
  id: string;
  kind: ProviderKind;
  name: string;
  description: string;
  enabled: boolean;
  /** Whether the provider is currently usable on this machine. */
  available: boolean;
  /** Fixed proxy port if the provider needs one (e.g. docker -> 7355). */
  proxyPort?: number;
}

export interface StartAppRequest {
  name: string;
  command: string;
  cwd: string;
  /** Desired URL hostname (e.g. "myapp.localhost"). */
  host: string;
  /** Fixed port, or undefined to auto-assign. */
  port?: number;
  tls: boolean;
  tld: string;
  /** Provider-specific settings (e.g. { compose: "compose.yml" }). */
  options?: Record<string, unknown>;
}

export interface StartAppResult {
  app: AppRecord;
  /** Env that should be injected / has been resolved for the child. */
  env?: Record<string, string>;
}

export interface StopAppRequest {
  id: string;
}

export interface Provider {
  readonly info: ProviderInfo;
  /** Detect availability; called at registry build. */
  detect(): Promise<boolean>;
  start(request: StartAppRequest): Promise<StartAppResult>;
  stop(request: StopAppRequest): Promise<void>;
  list(): Promise<AppRecord[]>;
}

/* ------------------------------------------------------------------ */
/* App / Route                                                        */
/* ------------------------------------------------------------------ */

export type AppStatus =
  | "starting"
  | "running"
  | "stopped"
  | "exited"
  | "error";

export type RouteSource =
  | "local"
  | "alias"
  | "docker"
  | "dockportless"
  | "external";

export interface AppRecord {
  id: string;
  name: string;
  /** Human label, e.g. the compose service name. */
  label?: string;
  command: string;
  cwd: string;
  status: AppStatus;
  pid?: number;
  port?: number;
  provider: string;
  url: string;
  env: Record<string, string>;
  startedAt?: string;
  stoppedAt?: string;
  error?: string;
}

export interface Route {
  host: string;
  target: string;
  protocol: "http" | "tcp" | "tls";
  project?: string;
  source: RouteSource;
  tls: boolean;
  port?: number; // proxy port this route is reachable on (usually the single proxy port)
  app?: AppRecord;
  createdAt: string;
}

export interface AliasRoute {
  host: string;
  target: string; // "127.0.0.1:8080" or "host:port"
  force?: boolean;
}

/* ------------------------------------------------------------------ */
/* Zod schemas (for runtime validation at the daemon boundary)        */
/* ------------------------------------------------------------------ */

export const appStatusSchema = z.enum([
  "starting",
  "running",
  "stopped",
  "exited",
  "error",
]);

export const appRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string().optional(),
  command: z.string(),
  cwd: z.string(),
  status: appStatusSchema,
  pid: z.number().int().optional(),
  port: z.number().int().optional(),
  provider: z.string(),
  url: z.string(),
  env: z.record(z.string(), z.string()),
  startedAt: z.string().optional(),
  stoppedAt: z.string().optional(),
  error: z.string().optional(),
});

export const routeSchema = z.object({
  host: z.string(),
  target: z.string(),
  protocol: z.enum(["http", "tcp", "tls"]),
  project: z.string().optional(),
  source: z.enum(["local", "alias", "docker", "dockportless", "external"]),
  tls: z.boolean(),
  port: z.number().int().optional(),
  app: appRecordSchema.optional(),
  createdAt: z.string(),
});

export const startAppRequestSchema = z.object({
  name: z.string(),
  command: z.string(),
  cwd: z.string(),
  host: z.string(),
  port: z.number().int().optional(),
  tls: z.boolean(),
  tld: z.string(),
  options: z.record(z.string(), z.unknown()).optional(),
});

/** Event emitted by the daemon over SSE for the dashboard. */
export type DaemonEvent =
  | { type: "app.started"; app: AppRecord }
  | { type: "app.stopped"; id: string; name: string }
  | { type: "app.updated"; app: AppRecord }
  | { type: "route.added"; route: Route }
  | { type: "route.removed"; host: string }
  | { type: "proxy.status"; running: boolean; port?: number; tls?: boolean }
  | { type: "config.updated"; scope: "global" | "project" }
  | { type: "provider.changed"; provider: ProviderInfo };

export const daemonEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("app.started"), app: appRecordSchema }),
  z.object({ type: z.literal("app.stopped"), id: z.string(), name: z.string() }),
  z.object({ type: z.literal("app.updated"), app: appRecordSchema }),
  z.object({ type: z.literal("route.added"), route: routeSchema }),
  z.object({ type: z.literal("route.removed"), host: z.string() }),
  z.object({
    type: z.literal("proxy.status"),
    running: z.boolean(),
    port: z.number().int().optional(),
    tls: z.boolean().optional(),
  }),
  z.object({ type: z.literal("config.updated"), scope: z.enum(["global", "project"]) }),
  z.object({ type: z.literal("provider.changed"), provider: z.unknown() }),
]);
