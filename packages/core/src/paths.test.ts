import { describe, expect, it } from "vitest";
import { buildHostname, buildUrl, isDnsLabel } from "./paths.js";

describe("buildHostname", () => {
  it("builds a bare name under the default TLD", () => {
    expect(buildHostname({ name: "myapp" })).toBe("myapp.localhost");
  });

  it("includes the project when the name differs", () => {
    expect(buildHostname({ name: "api", project: "myorg" })).toBe("api.myorg.localhost");
  });

  it("does not duplicate the project name when equal", () => {
    expect(buildHostname({ name: "myorg", project: "myorg" })).toBe("myorg.localhost");
  });

  it("handles a custom TLD and LAN mode", () => {
    expect(buildHostname({ name: "myapp", tld: "test" })).toBe("myapp.test");
    expect(buildHostname({ name: "myapp", project: "p", lan: true })).toBe("myapp.p.local");
  });
});

describe("buildUrl", () => {
  it("produces an https URL by default", () => {
    expect(buildUrl({ host: "myapp.localhost" })).toBe("https://myapp.localhost");
  });
  it("produces http when tls is false", () => {
    expect(buildUrl({ host: "myapp.localhost", tls: false })).toBe("http://myapp.localhost");
  });
  it("adds a non-standard port", () => {
    expect(buildUrl({ host: "myapp.localhost", port: 7355 })).toBe("https://myapp.localhost:7355");
  });
});

describe("isDnsLabel", () => {
  it("accepts valid DNS labels", () => {
    expect(isDnsLabel("myapp")).toBe(true);
    expect(isDnsLabel("my-app")).toBe(true);
    expect(isDnsLabel("a1")).toBe(true);
  });
  it("rejects invalid labels", () => {
    expect(isDnsLabel("MyApp")).toBe(false);
    expect(isDnsLabel("-bad")).toBe(false);
    expect(isDnsLabel("bad-")).toBe(false);
    expect(isDnsLabel("a.b")).toBe(false);
  });
});
