import { buildUrl } from "./paths.js";

/**
 * Build the environment injected into a child process, per the vercel portless
 * contract. Returns an env map to merge over the process env.
 */
export interface ChildEnvOptions {
  port: number;
  host: string; // public hostname, e.g. "myapp.localhost"
  bindHost?: string; // HOST the child should bind, usually "127.0.0.1"
  tls: boolean;
  proxyPort?: number;
  extra?: Record<string, string>;
  project?: string;
  envProfile?: string;
}

export function buildChildEnv(opts: ChildEnvOptions): Record<string, string> {
  const env: Record<string, string> = {
    PORT: String(opts.port),
    HOST: opts.bindHost ?? "127.0.0.1",
    PORTLESS_URL: buildUrl({ host: opts.host, tls: opts.tls, port: opts.proxyPort }),
    PORTLESS_PROJECT: opts.project ?? "",
    PORTLESS_HOST: opts.host,
  };
  if (opts.envProfile) env.PORTLESS_ENV = opts.envProfile;
  return { ...env, ...(opts.extra ?? {}) };
}

/**
 * Merge configuration-provided env with the base child env. `projectEnv` has
 * highest precedence (per-project env overrides global env).
 */
export function mergeEnv(
  base: Record<string, string>,
  globalEnv: Record<string, string>,
  projectEnv: Record<string, string>,
): Record<string, string> {
  return { ...base, ...globalEnv, ...projectEnv };
}
