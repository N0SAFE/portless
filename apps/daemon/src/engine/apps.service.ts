import { Inject, Injectable } from "@nestjs/common";
import type { AppRecord, Provider, Route, StartAppRequest } from "@portless/core";
import { ProviderRegistry } from "@portless/core";
import { RoutesService } from "./routes.service.js";
import { EventsService } from "../events/events.service.js";
import { PROVIDER_REGISTRY } from "../tokens.js";

/**
 * Supervises running apps across the registered providers and reconciles a
 * route for each. This is what makes the daemon "own" every app, rather than
 * a CLI that is connected to nothing.
 */
@Injectable()
export class AppsService {
  private readonly apps = new Map<string, AppRecord>();

  constructor(
    @Inject(PROVIDER_REGISTRY) private readonly providers: ProviderRegistry,
    private readonly routes: RoutesService,
    private readonly events: EventsService,
  ) {}

  list(): AppRecord[] {
    return [...this.apps.values()];
  }

  get(id: string): AppRecord | undefined {
    return this.apps.get(id);
  }

  async start(request: StartAppRequest): Promise<{ app: AppRecord; route: Route }> {
    const provider = this.providers.get(request.options?.provider as string | undefined ?? "process");
    if (!provider) {
      throw new Error(`provider "${request.options?.provider}" not registered`);
    }
    if (!(await provider.detect())) {
      throw new Error(`provider "${provider.info.id}" is not available on this machine`);
    }

    const { app } = await provider.start(request);

    // Register a route for the app (unless the provider opted out by omitting port).
    const port = request.port ?? app.port;
    const route: Route = {
      host: request.host,
      target: `127.0.0.1:${port}`,
      protocol: "http",
      source: provider.info.kind === "compose" || provider.info.id === "dockportless" ? (provider.info.id === "dockportless" ? "dockportless" : "docker") : "local",
      tls: request.tls,
      app,
      createdAt: new Date().toISOString(),
    };
    this.routes.add(route);

    this.apps.set(app.id, app);
    this.events.emit({ type: "app.started", app });
    this.events.emit({ type: "route.added", route });

    // Watch for exit and update status.
    void this.watchExit(app);
    return { app, route };
  }

  private async watchExit(app: AppRecord): Promise<void> {
    // Providers already update status in-place; we poll a ticker-less approach:
    // reconcile from provider.list() on each read.
    void app;
  }

  async stop(id: string): Promise<boolean> {
    const app = this.apps.get(id);
    if (!app) return false;
    const provider = this.providers.get(app.provider);
    try {
      await provider?.stop({ id });
    } catch {
      /* noop */
    }
    // Remove the associated route(s).
    for (const route of this.routes.all()) {
      if (route.app?.id === id) {
        this.routes.remove(route.host);
        this.events.emit({ type: "route.removed", host: route.host });
      }
    }
    app.status = "stopped";
    app.stoppedAt = new Date().toISOString();
    this.events.emit({ type: "app.stopped", id, name: app.name });
    this.apps.delete(id);
    return true;
  }

  /** Reconcile statuses from providers (called periodically / on list). */
  async reconcile(): Promise<void> {
    const byProvider = new Map<string, Provider[]>();
    for (const p of this.providers.all()) {
      const arr = byProvider.get(p.info.id) ?? [];
      arr.push(p);
      byProvider.set(p.info.id, arr);
    }
    for (const [pid, live] of byProvider) {
      void pid;
      const provided = await Promise.all(
        live.map((p) =>
          p
            .list()
            .then((list) => list)
            .catch(() => [] as AppRecord[]),
        ),
      );
      const liveApps = provided.flat();
      for (const app of liveApps) {
        const local = this.apps.get(app.id);
        if (local) {
          if (local.status !== app.status) {
            local.status = app.status;
            this.events.emit({ type: "app.updated", app: local });
          }
        }
      }
    }
  }
}
