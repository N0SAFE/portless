import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { portlessPaths } from "@portless/core";
import { loadConfig, type LoadedConfig } from "@portless/config";
import { EventsService } from "../events/events.service.js";

@Injectable()
export class ConfigService {
  constructor(private readonly events: EventsService) {}

  async read(): Promise<{ global: Record<string, unknown>; project?: Record<string, unknown>; projectDir?: string }> {
    const loaded: LoadedConfig = await loadConfig();
    const projectJson =
      loaded.projectDir && loaded.project
        ? (await readJsonSafe<Record<string, unknown>>(path.join(loaded.projectDir, "portless.json"))) ?? (loaded.project as unknown as Record<string, unknown>)
        : undefined;
    return {
      global: loaded.global as unknown as Record<string, unknown>,
      project: projectJson,
      projectDir: loaded.projectDir,
    };
  }

  async update(patch: Record<string, unknown>, scope: "global" | "project"): Promise<Record<string, unknown>> {
    const p = portlessPaths(process.env);
    if (scope === "global") {
      const currentRaw = await readJsonSafe<Record<string, unknown>>(p.configFile).catch(() => undefined);
      const next = deepMerge(currentRaw ?? {}, patch);
      await mkdir(path.dirname(p.configFile), { recursive: true });
      await writeFile(p.configFile, JSON.stringify(next, null, 2), "utf8");
      this.events.emit({ type: "config.updated", scope: "global" });
      return next;
    }
    // Project scope: find nearest portless.json from cwd.
    const loaded = await loadConfig();
    const dir = loaded.projectDir ?? process.cwd();
    const file = loaded.projectDir ? path.join(loaded.projectDir, "portless.json") : path.join(dir, "portless.json");
    const currentRaw = await readJsonSafe<Record<string, unknown>>(file).catch(() => undefined);
    const next = deepMerge(currentRaw ?? {}, patch);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(next, null, 2), "utf8");
    this.events.emit({ type: "config.updated", scope: "project" });
    return next;
  }
}

async function readJsonSafe<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) {
      delete out[k];
    } else if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
