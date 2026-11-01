import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  allocateFreePort,
  buildChildEnv,
  buildUrl,
  runCommand,
  type AppRecord,
  type Provider,
  type StartAppRequest,
  type StartAppResult,
} from "@portless/core";

/**
 * The `docker` provider — dockportless-style routing for Docker Compose.
 *
 * Parses the project's `compose.yml`, discovers services, assigns each one a
 * free port, sets `<SERVICE>_PORT` (and `<SERVICE>_PORT_N` for multi-port
 * services, mirroring `mazrean/dockportless`), and runs `docker compose up`.
 * Each service is registered as a named route on the proxy.
 */
export class DockerProvider implements Provider {
  readonly info = {
    id: "docker",
    kind: "compose" as const,
    name: "Docker Compose",
    description: "Run a compose stack; route each service on a named URL",
    enabled: true,
    available: false,
    proxyPort: 7355,
  };

  private readonly running = new Map<string, AppRecord>();

  async detect(): Promise<boolean> {
    try {
      const { execFile } = await import("node:child_process");
      const { promisify } = await import("node:util");
      const run = promisify(execFile);
      await run("docker", ["compose", "version"]);
      this.info.available = true;
      return true;
    } catch {
      this.info.available = false;
      return false;
    }
  }

  private async readCompose(cwd: string, file?: string): Promise<{ services: Record<string, { ports?: string[] }> } | undefined> {
    const target = file ? path.resolve(cwd, file) : path.join(cwd, "compose.yml");
    try {
      const raw = await readFile(target, "utf8");
      // Minimal YAML "parser" for `services:` key names. We avoid pulling a YAML
      // dep into core; real parsing happens in the shelled compose tool. This
      // only needs to discover service names + port declarations.
      const services: Record<string, { ports?: string[] }> = {};
      const lines = raw.split("\n");
      let inServices = false;
      let currentService: string | undefined;
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^services:\s*$/.test(line)) {
          inServices = true;
          continue;
        }
        if (inServices && /^[a-zA-Z0-9_-]+:\s*$/.test(line) && !line.startsWith(" ") && line !== "") {
          currentService = trimmed.slice(0, -1);
          services[currentService] = {};
          continue;
        }
        if (inServices && currentService && /^ports:\s*$/.test(line)) {
          services[currentService].ports = services[currentService].ports ?? [];
          continue;
        }
        if (inServices && currentService && services[currentService].ports && /^-\s*/.test(line)) {
          services[currentService].ports!.push(trimmed.slice(1).trim());
          continue;
        }
        if (inServices && currentService && /^[a-zA-Z0-9_-]+:\s*$/.test(line) && (line.startsWith("  ") || line.startsWith("\t"))) {
          // other service keys
          continue;
        }
      }
      return { services };
    } catch {
      return undefined;
    }
  }

  async start(request: StartAppRequest): Promise<StartAppResult> {
    const composeFile = request.options?.file as string | undefined;
    const compose = await this.readCompose(request.cwd, composeFile);
    const serviceNames = compose ? Object.keys(compose.services) : [];

    const portAssignments = new Map<string, number>();
    for (const name of serviceNames) {
      const declared = compose?.services[name]?.ports?.map((p) => {
        const host = p.split(":")[0];
        const n = Number(host);
        return Number.isNaN(n) ? undefined : n;
      });
      const preferred = declared?.find((p): p is number => p !== undefined);
      portAssignments.set(name, preferred ?? (await allocateFreePort()));
    }

    // Compose file env, with SERVICE_PORT variables for the spawned command.
    const stackEnv: Record<string, string> = { ...(request.options?.env as Record<string, string> | undefined) };
    for (const [name, port] of portAssignments) {
      stackEnv[`${snake(name)}_PORT`] = String(port);
      stackEnv[`${snake(name)}_PORT_0`] = String(port);
      stackEnv[`${upper(name)}_PORT`] = String(port);
    }

    const composeCmd = (request.options?.composeCommand as string | undefined) ?? "docker compose";
    const [bin, ...baseArgs] = composeCmd.split(" ");
    const args = [
      ...baseArgs,
      ...(composeFile ? ["-f", composeFile] : []),
      "up",
      "-d",
      ...(request.options?.services ? (request.options.services as string[]) : []),
    ];

    const spawned = runCommand({
      command: bin || "docker",
      args,
      cwd: request.cwd,
      env: stackEnv,
      shell: false,
    });

    const id = randomUUID();
    const host = request.host;
    // The proxy port used for the whole stack (dockportless convention).
    const proxyPort = (request.options?.proxyPort as number | undefined) ?? 7355;
    const app: AppRecord = {
      id,
      name: request.name,
      command: `${composeCmd} ${args.join(" ")}`,
      cwd: request.cwd,
      status: "starting",
      pid: spawned.child.pid,
      provider: "docker",
      url: buildUrl({ host, tls: request.tls, port: proxyPort }),
      env: stackEnv,
      startedAt: new Date().toISOString(),
    };

    void spawned.exited.then((code) => {
      const cur = this.running.get(id);
      if (cur) {
        cur.status = code === 0 ? "exited" : "error";
        cur.stoppedAt = new Date().toISOString();
        cur.pid = undefined;
      }
    });

    this.running.set(id, app);
    app.status = "running";
    return { app, env: stackEnv };
  }

  async stop(request: { id: string }): Promise<void> {
    // Best-effort: kill the compose process. Containers remain unless the user
    // runs `portless down`; we surface that in docs.
    const app = this.running.get(request.id);
    if (app?.pid) {
      try {
        process.kill(app.pid, "SIGTERM");
      } catch {
        /* noop */
      }
    }
    if (app) {
      app.status = "stopped";
      app.stoppedAt = new Date().toISOString();
      app.pid = undefined;
    }
    this.running.delete(request.id);
  }

  async list(): Promise<AppRecord[]> {
    return [...this.running.values()];
  }
}

function snake(input: string): string {
  return input.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
}
function upper(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}
