import type {
  AliasRoute,
  AppRecord,
  DaemonEvent,
  ProviderInfo,
  Route,
  StartAppRequest,
} from "@portless/core";

/**
 * @portless/contracts — the daemon control-plane REST API.
 *
 * These types are shared by the daemon (implementor), the CLI and dashboard
 * (consumers). Keep them framework-agnostic.
 */

/* ------------------------------------------------------------------ */
/* Health                                                             */
/* ------------------------------------------------------------------ */

export interface HealthResponse {
  ok: boolean;
  service: "portless-daemon";
  version: string;
  uptimeMs: number;
  proxy: {
    running: boolean;
    port?: number;
    tls?: boolean;
  };
}

/* ------------------------------------------------------------------ */
/* Routes                                                             */
/* ------------------------------------------------------------------ */

export type AddRouteRequest = AliasRoute;
export interface AddRouteResponse {
  route: Route;
}

export interface ListRoutesResponse {
  routes: Route[];
}

export interface RemoveRouteResponse {
  ok: boolean;
  removed: boolean;
}

/* ------------------------------------------------------------------ */
/* Apps                                                               */
/* ------------------------------------------------------------------ */

export type StartAppRequestContract = StartAppRequest;

export interface StartAppResponse {
  app: AppRecord;
  route: Route;
}

export interface ListAppsResponse {
  apps: AppRecord[];
}

export interface StopAppResponse {
  ok: boolean;
}

/* ------------------------------------------------------------------ */
/* Projects                                                           */
/* ------------------------------------------------------------------ */

export interface ProjectSummary {
  root: string;
  name: string;
  hasProjectConfig: boolean;
  packages: {
    relativePath: string;
    name: string;
    hasDevScript: boolean;
  }[];
}

export interface ListProjectsResponse {
  projects: ProjectSummary[];
}

/* ------------------------------------------------------------------ */
/* Hosts                                                              */
/* ------------------------------------------------------------------ */

export interface HostEntry {
  host: string;
  ip: string;
}

export interface HostsResponse {
  hosts: HostEntry[];
}

export interface HostsSyncResponse {
  ok: boolean;
  synced: number;
}

/* ------------------------------------------------------------------ */
/* Config                                                             */
/* ------------------------------------------------------------------ */

export interface GetConfigResponse {
  global: Record<string, unknown>;
  project?: Record<string, unknown>;
  projectDir?: string;
}

export interface UpdateConfigRequest {
  scope: "global" | "project";
  /** JSON merge-patch applied to the current config. */
  patch: Record<string, unknown>;
}

export interface UpdateConfigResponse {
  ok: boolean;
  global: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/* Plugins / providers                                                */
/* ------------------------------------------------------------------ */

export interface ListPluginsResponse {
  providers: ProviderInfo[];
}

/* ------------------------------------------------------------------ */
/* Certs                                                              */
/* ------------------------------------------------------------------ */

export interface CertsStatusResponse {
  caInstalled: boolean;
  caPath?: string;
  trustStoreAttempted?: boolean;
  trustStoreOk?: boolean;
}

/* ------------------------------------------------------------------ */
/* Events (SSE)                                                       */
/* ------------------------------------------------------------------ */

export type { DaemonEvent };
export interface EventsEndpoint {
  stream: DaemonEvent;
}

/* ------------------------------------------------------------------ */
/* OpenAPI-ish path table (documentation aid)                         */
/* ------------------------------------------------------------------ */

export const API_PATHS = {
  health: "/api/v1/health",
  routes: "/api/v1/routes",
  route: (host: string) => `/api/v1/routes/${encodeURIComponent(host)}`,
  apps: "/api/v1/apps",
  appStop: (id: string) => `/api/v1/apps/${encodeURIComponent(id)}/stop`,
  projects: "/api/v1/projects",
  hosts: "/api/v1/hosts",
  hostsSync: "/api/v1/hosts/sync",
  hostsClean: "/api/v1/hosts/clean",
  config: "/api/v1/config",
  plugins: "/api/v1/plugins",
  certs: "/api/v1/certs",
  trust: "/api/v1/certs/trust",
  events: "/api/v1/events",
} as const;
