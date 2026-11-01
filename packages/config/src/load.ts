import { readFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { portlessPaths, type PortlessPaths } from "@portless/core";
import { DEFAULT_GLOBAL_CONFIG } from "./defaults.js";
import { globalConfigSchema, projectConfigSchema, type GlobalConfig, type ProjectConfig } from "./types.js";

export interface LoadedConfig {
  global: GlobalConfig;
  paths: PortlessPaths;
  projectDir?: string;
  project?: ProjectConfig;
  packageJson?: Record<string, unknown>;
}

export interface LoadOptions {
  /** Working directory; project config discovery starts here and walks up. */
  cwd?: string;
  /** File path to a specific project config (used by `portless config`). */
  projectConfigFile?: string;
}

/** Read + parse a JSON file, returning undefined on any failure. */
async function readJson<T>(file: string): Promise<T | undefined> {
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

/** Find the nearest package.json starting at cwd and walking up. */
export function findPackageJson(startDir: string): string | undefined {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, "package.json");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Walk up from cwd looking for a `portless.json`. */
export function findProjectConfig(startDir: string): string | undefined {
  let dir = path.resolve(startDir);
  for (;;) {
    const candidate = path.join(dir, "portless.json");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/** Merge a package.json#portless value (string or object) into a project config. */
function mergePackagePortless(
  base: ProjectConfig,
  portlessKey: unknown,
): ProjectConfig {
  if (typeof portlessKey === "string") {
    return { ...base, name: portlessKey };
  }
  if (portlessKey && typeof portlessKey === "object") {
    const parsed = projectConfigSchema.safeParse({ ...base, ...(portlessKey as object) });
    return parsed.success ? { ...base, ...(parsed.data as ProjectConfig) } : base;
  }
  return base;
}

export async function loadConfig(opts: LoadOptions = {}): Promise<LoadedConfig> {
  const cwd = path.resolve(opts.cwd ?? process.cwd());
  const paths = portlessPaths(process.env);

  // 1) Global config
  let global: GlobalConfig = { ...DEFAULT_GLOBAL_CONFIG };
  const globalRaw = await readJson<Record<string, unknown>>(paths.configFile);
  if (globalRaw) {
    const parsed = globalConfigSchema.safeParse(globalRaw);
    if (parsed.success) global = { ...global, ...parsed.data };
  }

  // 2) Project config
  const projectFile = opts.projectConfigFile ?? findProjectConfig(cwd);
  let projectDir: string | undefined;
  let project: ProjectConfig | undefined;
  if (projectFile) {
    projectDir = path.dirname(projectFile);
    const raw = await readJson<Record<string, unknown>>(projectFile);
    if (raw) {
      const parsed = projectConfigSchema.safeParse(raw);
      if (parsed.success) project = parsed.data;
    }
  }

  // 3) package.json
  const pkgFile = opts.projectConfigFile ? findPackageJson(path.dirname(opts.projectConfigFile)) : findPackageJson(cwd);
  const packageJson = pkgFile ? await readJson<Record<string, unknown>>(pkgFile) : undefined;

  // 4) Merge package.json#portless into project config.
  if (packageJson && "portless" in packageJson && project !== undefined) {
    project = mergePackagePortless(project, packageJson.portless);
  } else if (packageJson && "portless" in packageJson && project === undefined && pkgFile) {
    project = mergePackagePortless({}, packageJson.portless);
    projectDir = projectDir ?? path.dirname(pkgFile);
  }

  return {
    global,
    paths,
    projectDir,
    project,
    packageJson,
  };
}
