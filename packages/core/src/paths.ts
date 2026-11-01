import { homedir } from "node:os";
import path from "node:path";
import { DEFAULT_TLD, LAN_TLD, PORTLESS_STATE_DIR_DEFAULT } from "./types.js";

/**
 * Path / naming helpers shared across the daemon and CLI.
 */

export function expandHome(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return path.join(homedir(), p.slice(2));
  if (p.startsWith("~")) return path.join(homedir(), p.slice(1));
  return p;
}

export interface PortlessPaths {
  /** Root state dir, e.g. ~/.portless */
  stateDir: string;
  /** Daemon data: routes, apps, pid. */
  daemonDir: string;
  /** CA certificate + key. */
  certFile: string;
  certKeyFile: string;
  /** Global config file. */
  configFile: string;
  /** Runtime pid file for the daemon. */
  pidFile: string;
  /** SQLite-less JSON store for routes/apps. */
  storeFile: string;
  /** Log directory. */
  logDir: string;
}

/**
 * Resolve paths from an env override or default. Under sudo we resolve from
 * the invoking user's home so the proxy and unprivileged apps share state.
 */
export function portlessPaths(env: Partial<NodeJS.ProcessEnv> = process.env): PortlessPaths {
  const base = expandHome(
    env.PORTLESS_STATE_DIR ?? PORTLESS_STATE_DIR_DEFAULT,
  );
  const stateDir = base.endsWith(".portless") ? base : base;
  const daemonDir = path.join(stateDir, "daemon");
  const certDir = path.join(stateDir, "certs");
  return {
    stateDir,
    daemonDir,
    certFile: path.join(certDir, "portless-ca.pem"),
    certKeyFile: path.join(certDir, "portless-ca-key.pem"),
    configFile: path.join(stateDir, "config.json"),
    pidFile: path.join(daemonDir, "daemon.pid"),
    storeFile: path.join(daemonDir, "store.json"),
    logDir: path.join(stateDir, "logs"),
  };
}

/**
 * Build the public hostname for an app under a project.
 *
 * Rules (mirroring vercel-labs/portless):
 * - `{name}.{tld}`
 * - If a project is supplied and the name is not the bare project name,
 *   `{name}.{project}.{tld}`.
 * - LAN mode uses `.local` instead of the configured TLD.
 */
export function buildHostname(opts: {
  name: string;
  project?: string;
  tld?: string;
  lan?: boolean;
}): string {
  const tld = opts.lan ? LAN_TLD : opts.tld ?? DEFAULT_TLD;
  const base =
    opts.project && opts.name !== opts.project
      ? `${opts.name}.${opts.project}`
      : opts.name;
  return `${base}.${tld}`;
}

/**
 * Build the public URL for an app.
 */
export function buildUrl(opts: {
  host: string;
  tls?: boolean;
  port?: number;
}): string {
  const scheme = opts.tls === false ? "http" : "https";
  const host = opts.port && ![80, 443].includes(opts.port) ? `${opts.host}:${opts.port}` : opts.host;
  return `${scheme}://${host}`;
}

/** Validate a DNS label (single hostname segment). */
export function isDnsLabel(label: string): boolean {
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
}
