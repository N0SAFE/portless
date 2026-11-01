import type { GlobalConfig } from "./types.js";

/**
 * Compiled defaults (lowest precedence). These mirror vercel-labs/portless
 * defaults and are overridden by global config, project config, env, flags.
 */
export const DEFAULT_GLOBAL_CONFIG: GlobalConfig = {
  version: 1,
  tld: "localhost",
  tls: true,
  lan: false,
  wildcard: false,
  syncHosts: true,
  defaultProvider: "process",
  providers: {
    process: { enabled: true },
    docker: { enabled: true, bin: "docker compose" },
    dockportless: { enabled: true, bin: "dockportless" },
  },
  env: {
    NODE_ENV: "development",
  },
};
