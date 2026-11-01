import { describe, expect, it } from "vitest";
import { RoutesService } from "./routes.service.js";
import type { Route } from "@portless/core";

function route(host: string, target = "127.0.0.1:4123", source: Route["source"] = "local"): Route {
  return { host, target, protocol: "http", source, tls: true, createdAt: new Date().toISOString() };
}

describe("RoutesService", () => {
  it("resolves an exact route", () => {
    const svc = new RoutesService();
    svc.setRoutesForTest([route("myapp.localhost")], false);
    expect(svc.resolve("myapp.localhost")?.target).toBe("127.0.0.1:4123");
  });

  it("returns undefined for unknown host in strict mode", () => {
    const svc = new RoutesService();
    svc.setRoutesForTest([route("myapp.localhost")], false);
    expect(svc.resolve("other.localhost")).toBeUndefined();
  });

  it("falls back to the parent route in wildcard mode", () => {
    const svc = new RoutesService();
    svc.setRoutesForTest([route("myapp.localhost")], true);
    const resolved = svc.resolve("tenant1.myapp.localhost");
    expect(resolved?.host).toBe("tenant1.myapp.localhost");
    expect(resolved?.target).toBe("127.0.0.1:4123");
  });

  it("overwrites an alias without force, but blocks aliasing over a live app route", () => {
    const svc = new RoutesService();
    // alias-over-alias silently overwrites
    svc.addAlias({ host: "db.localhost", target: "127.0.0.1:5432" }, false);
    expect(svc.resolve("db.localhost")?.target).toBe("127.0.0.1:5432");
    expect(svc.addAlias({ host: "db.localhost", target: "127.0.0.1:9999" }, false).target).toBe("127.0.0.1:9999");

    // aliasing over a live local app route throws without --force
    const svc2 = new RoutesService();
    svc2.setRoutesForTest([route("app.localhost")], false);
    expect(() => svc2.addAlias({ host: "app.localhost", target: "127.0.0.1:9999" }, false)).toThrow();
    expect(svc2.addAlias({ host: "app.localhost", target: "127.0.0.1:9999" }, true).target).toBe("127.0.0.1:9999");
  });
});
