import type {
  AliasRoute,
  AppRecord,
  DaemonEvent,
  ProviderInfo,
  Route,
  StartAppRequest,
} from "./types.js";
import { PORTLESS_DAEMON_PORT_DEFAULT } from "./types.js";

/**
 * Typed client for the daemon control-plane HTTP API.
 *
 * The CLI and dashboard use this to talk to the daemon. If the daemon is not
 * reachable, `isReachable` returns false and the caller can decide to start it.
 */
export interface DaemonClientOptions {
  host?: string;
  port?: number;
  token?: string;
  timeoutMs?: number;
}

export class DaemonClient {
  readonly baseUrl: string;
  private readonly token?: string;
  private readonly timeoutMs: number;

  constructor(opts: DaemonClientOptions = {}) {
    const host = opts.host ?? "127.0.0.1";
    const port = opts.port ?? (Number(process.env.PORTLESS_DAEMON_PORT) || PORTLESS_DAEMON_PORT_DEFAULT);
    this.token = opts.token ?? process.env.PORTLESS_DAEMON_TOKEN;
    this.timeoutMs = opts.timeoutMs ?? 5000;
    this.baseUrl = `http://${host}:${port}`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const headers: Record<string, string> = {
        "content-type": "application/json",
      };
      if (this.token) headers.authorization = `Bearer ${this.token}`;
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`daemon ${method} ${path} -> ${res.status}: ${text}`);
      }
      const ct = res.headers.get("content-type") ?? "";
      if (ct.includes("application/json")) return (await res.json()) as T;
      return undefined as T;
    } finally {
      clearTimeout(timer);
    }
  }

  async isReachable(): Promise<boolean> {
    try {
      await this.request<{ ok: boolean }>("GET", "/api/v1/health");
      return true;
    } catch {
      return false;
    }
  }

  async health(): Promise<{ ok: boolean; version?: string; proxy?: { running: boolean; port?: number; tls?: boolean } }> {
    return this.request("GET", "/api/v1/health");
  }

  listRoutes(): Promise<Route[]> {
    return this.request("GET", "/api/v1/routes");
  }

  addAlias(alias: AliasRoute): Promise<Route> {
    return this.request("POST", "/api/v1/routes", { ...alias, source: "alias" });
  }

  removeRoute(host: string): Promise<{ ok: boolean; removed: boolean }> {
    return this.request("DELETE", `/api/v1/routes/${encodeURIComponent(host)}`);
  }

  listApps(): Promise<AppRecord[]> {
    return this.request("GET", "/api/v1/apps");
  }

  startApp(request: StartAppRequest): Promise<{ app: AppRecord; route: Route }> {
    return this.request("POST", "/api/v1/apps", request);
  }

  stopApp(id: string): Promise<{ ok: boolean }> {
    return this.request("POST", `/api/v1/apps/${encodeURIComponent(id)}/stop`);
  }

  listProviders(): Promise<{ providers: ProviderInfo[] }> {
    return this.request("GET", "/api/v1/plugins");
  }

  /** Install the local CA into the OS trust store (may require sudo). */
  trust(): Promise<{
    caInstalled: boolean;
    caPath?: string;
    trustStoreAttempted?: boolean;
    trustStoreOk?: boolean;
  }> {
    return this.request("POST", "/api/v1/certs/trust");
  }

  proxyStart(options: {
    port?: number;
    tls?: boolean;
    lan?: boolean;
    wildcard?: boolean;
    cert?: string;
    key?: string;
    tcpProxyPort?: number;
  } = {}): Promise<{ ok: boolean; port?: number; tls?: boolean }> {
    return this.request("POST", "/api/v1/proxy/start", options);
  }

  proxyStop(): Promise<{ ok: boolean }> {
    return this.request("POST", "/api/v1/proxy/stop");
  }

  getConfig(): Promise<{
    global: Record<string, unknown>;
    project?: Record<string, unknown>;
    projectDir?: string;
  }> {
    return this.request("GET", "/api/v1/config");
  }

  updateConfig(
    scope: "global" | "project",
    patch: Record<string, unknown>,
  ): Promise<{ ok: boolean; global: Record<string, unknown> }> {
    return this.request("PUT", "/api/v1/config", { scope, patch });
  }

  /** Open an SSE stream of daemon events; returns an unsubscribe function. */
  subscribe(onEvent: (event: DaemonEvent) => void): () => void {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch(`${this.baseUrl}/api/v1/events`, {
          headers: this.token ? { authorization: `Bearer ${this.token}` } : {},
          signal: controller.signal,
        });
        if (!res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) >= 0) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const line = raw.split("\n").find((l) => l.startsWith("data:"));
            if (line) {
              try {
                onEvent(JSON.parse(line.slice(5).trim()) as DaemonEvent);
              } catch {
                /* ignore malformed */
              }
            }
          }
        }
      } catch {
        /* stream closed */
      }
    })();
    return () => controller.abort();
  }
}
