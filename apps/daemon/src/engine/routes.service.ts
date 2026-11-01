import { Injectable } from "@nestjs/common";
import type { AliasRoute, Route } from "@portless/core";

/**
 * The in-memory + persisted route table. Resolves a hostname to a route with
 * optional wildcard fallback (unregistered subdomains fall back to the parent).
 */
@Injectable()
export class RoutesService {
  private readonly routes = new Map<string, Route>();
  private wildcard = false;

  setWildcard(enabled: boolean): void {
    this.wildcard = enabled;
  }

  getWildcard(): boolean {
    return this.wildcard;
  }

  all(): Route[] {
    return [...this.routes.values()];
  }

  add(route: Route): void {
    this.routes.set(route.host, route);
  }

  /** Add or overwrite an alias route (static host -> target). */
  addAlias(alias: AliasRoute, force: boolean): Route {
    const existing = this.routes.get(alias.host);
    if (existing && existing.source !== "alias" && !force) {
      throw new Error(`route "${alias.host}" already exists (source=${existing.source}); use --force to overwrite`);
    }
    const now = new Date().toISOString();
    const route: Route = {
      host: alias.host,
      target: alias.target,
      protocol: "http",
      source: "alias",
      tls: true,
      createdAt: now,
    };
    this.routes.set(alias.host, route);
    return route;
  }

  remove(host: string): Route | undefined {
    const route = this.routes.get(host);
    this.routes.delete(host);
    return route;
  }

  /**
   * Resolve a hostname to a route. If not exact, and wildcard is enabled,
   * try the parent labels (strip one label at a time) and fall back to the
   * best parent route that serves this TLD.
   */
  resolve(host: string): Route | undefined {
    const exact = this.routes.get(host);
    if (exact) return exact;

    if (this.wildcard) {
      const labels = host.split(".");
      for (let i = 1; i < labels.length - 1; i++) {
        const parent = labels.slice(i).join(".");
        const route = this.routes.get(parent);
        if (route) return { ...route, host };
      }
    }
    return undefined;
  }

  get(host: string): Route | undefined {
    return this.routes.get(host);
  }

  setRoutesForTest(routes: Route[], wildcard: boolean): void {
    this.routes.clear();
    for (const r of routes) this.routes.set(r.host, r);
    this.wildcard = wildcard;
  }
}
