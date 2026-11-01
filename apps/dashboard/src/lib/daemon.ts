import type { DaemonEvent, ProviderInfo, Route } from "@portless/core";

/**
 * Server-side access to the portless daemon control plane. The base URL is
 * configurable via `PORTLESS_DAEMON_URL` (e.g. in docker-compose when the
 * dashboard runs in its own container) and defaults to the local daemon.
 */
export const DAEMON_URL =
  process.env.PORTLESS_DAEMON_URL ?? `http://127.0.0.1:${process.env.PORTLESS_DAEMON_PORT ?? 4711}`;

export interface DashboardHealth {
  ok: boolean;
  version?: string;
  proxy?: { running: boolean; port?: number; tls?: boolean };
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${DAEMON_URL}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchHealth(): Promise<DashboardHealth> {
  const h = await getJson<DashboardHealth>("/api/v1/health");
  return h ?? { ok: false };
}

export async function fetchRoutes(): Promise<Route[] | null> {
  const res = await getJson<{ routes: Route[] }>("/api/v1/routes");
  return res?.routes ?? null;
}

export async function fetchApps(): Promise<{ id: string; name: string; status: string; url: string; provider: string }[] | null> {
  const res = await getJson<{ apps: { id: string; name: string; status: string; url: string; provider: string }[] }>("/api/v1/apps");
  return res?.apps ?? null;
}

export async function fetchProviders(): Promise<ProviderInfo[] | null> {
  const res = await getJson<{ providers: ProviderInfo[] }>("/api/v1/plugins");
  return res?.providers ?? null;
}

export { DAEMON_URL as daemonUrl };
export type { DaemonEvent };
