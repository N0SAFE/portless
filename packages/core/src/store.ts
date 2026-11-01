import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * A tiny, dependency-free JSON file store used by the daemon to persist
 * routes, apps, and preferred settings across restarts. For local dev tooling
 * a JSON file is the right granularity; we avoid pulling in SQLite/Redis.
 */
export interface JsonStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
  delete(key: string): void;
  /** Persist the in-memory state to disk. */
  flush(): Promise<void>;
  /** Load from disk, if present. */
  load(): Promise<void>;
}

export async function openJsonStore(file: string): Promise<JsonStore> {
  const data = new Map<string, unknown>();
  let dirty = false;

  return {
    get<T>(key: string): T | undefined {
      return data.get(key) as T | undefined;
    },
    set<T>(key: string, value: T): void {
      data.set(key, value);
      dirty = true;
    },
    has(key: string): boolean {
      return data.has(key);
    },
    delete(key: string): void {
      data.delete(key);
      dirty = true;
    },
    async flush() {
      if (!dirty) return;
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, JSON.stringify(Object.fromEntries(data), null, 2), "utf8");
      dirty = false;
    },
    async load() {
      try {
        const raw = await readFile(file, "utf8");
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        for (const [k, v] of Object.entries(parsed)) data.set(k, v);
      } catch {
        /* no file yet */
      }
    },
  };
}
