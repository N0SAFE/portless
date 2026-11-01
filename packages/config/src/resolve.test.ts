import { describe, expect, it } from "vitest";
import type { GlobalConfig, ProjectConfig } from "./types.js";
import { resolveApp, resolveRuntime } from "./resolve.js";

const globalConfig: GlobalConfig = {
  version: 1,
  tld: "localhost",
  tls: true,
  lan: false,
  wildcard: false,
  syncHosts: true,
  defaultProvider: "process",
  env: { NODE_ENV: "development" },
};

function runtime(overrides = {}) {
  return resolveRuntime(globalConfig, { ...overrides });
}

describe("resolveApp", () => {
  it("infers a name from the project and default script", () => {
    const project: ProjectConfig = { name: "myapp", script: "dev" };
    const app = resolveApp(globalConfig, project, runtime(), { projectName: "myapp" });
    expect(app.name).toBe("myapp");
    expect(app.script).toBe("dev");
    expect(app.host).toBe("myapp.localhost");
  });

  it("applies per-project env over global env", () => {
    const project: ProjectConfig = {
      name: "myapp",
      env: { NODE_ENV: "production", MYAPP: "1" },
    };
    const app = resolveApp(globalConfig, project, runtime(), { projectName: "myapp" });
    expect(app.env["NODE_ENV"]).toBe("production");
    expect(app.env["MYAPP"]).toBe("1");
  });

  it("selects a global env profile via --env", () => {
    const globalWithProfiles: GlobalConfig = {
      ...globalConfig,
      envProfiles: { dev: { LOG_LEVEL: "debug" } },
    };
    const app = resolveApp(globalWithProfiles, undefined, runtime(), {
      projectName: "myapp",
      envProfile: "dev",
    });
    expect(app.env["LOG_LEVEL"]).toBe("debug");
  });

  it("host includes the project when name differs", () => {
    const project: ProjectConfig = { name: "myorg" };
    const app = resolveApp(globalConfig, project, runtime(), { projectName: "myorg", name: "api" });
    expect(app.host).toBe("api.myorg.localhost");
  });
});

describe("resolveRuntime", () => {
  it("defaults to tls + 443", () => {
    const r = resolveRuntime(globalConfig);
    expect(r.tls).toBe(true);
    expect(r.proxyPort).toBe(443);
  });
  it("respects a no-tls override", () => {
    const r = resolveRuntime(globalConfig, { tls: false });
    expect(r.tls).toBe(false);
  });
});
