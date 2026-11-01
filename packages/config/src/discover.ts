import { readFile } from "node:fs/promises";
import { readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { findPackageJson } from "./load.js";

export interface WorkspacePackage {
  /** Relative path from the workspace root, e.g. "apps/web". */
  relativePath: string;
  /** Absolute path. */
  absPath: string;
  name: string;
  scripts?: Record<string, string>;
}

export interface WorkspaceInfo {
  root: string;
  packages: WorkspacePackage[];
}

/** Parse the `workspaces` globs and expand them. */
function expandPatterns(base: string, patterns: string[]): string[] {
  const out: string[] = [];
  for (const pattern of patterns) {
    if (pattern.includes("*")) {
      // Simple two-level glob: "apps/*" or "packages/*"
      const prefix = pattern.split("*")[0] ?? "";
      const dir = path.join(base, prefix);
      if (existsSync(dir)) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            const p = path.join(dir, entry.name);
            if (existsSync(path.join(p, "package.json"))) out.push(p);
          }
        }
      }
    } else {
      const p = path.join(base, pattern);
      if (existsSync(path.join(p, "package.json"))) out.push(p);
    }
  }
  return out;
}

/**
 * Discover workspace packages. Supports pnpm-workspace.yaml, the `workspaces`
 * field in package.json (npm/yarn/bun), and falls back to a single package.
 */
export async function discoverWorkspace(startDir: string): Promise<WorkspaceInfo> {
  let root = path.resolve(startDir);
  let pnpmPatterns: string[] | undefined;
  let wsPatterns: string[] | undefined;

  for (;;) {
    const pnpm = path.join(root, "pnpm-workspace.yaml");
    if (existsSync(pnpm)) {
      const raw = await readFile(pnpm, "utf8");
      const m = raw.match(/packages:\s*\n((?:\s*-\s*.+\n?)+)/);
      if (m) {
        pnpmPatterns = m[1]
          .split("\n")
          .map((l) => l.trim().replace(/^-\s*/, ""))
          .filter((l) => l.length > 0);
      }
    }
    const pkgFile = findPackageJson(root);
    if (pkgFile) {
      const pkg = JSON.parse((await readFile(pkgFile, "utf8")) as string) as {
        workspaces?: string[] | { packages?: string[] };
      };
      if (Array.isArray(pkg.workspaces)) wsPatterns = pkg.workspaces;
      else if (pkg.workspaces && Array.isArray(pkg.workspaces.packages)) {
        wsPatterns = pkg.workspaces.packages;
      }
    }
    if (pnpmPatterns || wsPatterns) break;
    const parent = path.dirname(root);
    if (parent === root) break;
    root = parent;
  }

  const patterns = pnpmPatterns ?? wsPatterns;
  if (!patterns) {
    // Single package (not a monorepo).
    const pkgFile = findPackageJson(startDir);
    if (pkgFile) {
      const root = path.dirname(pkgFile);
      const pkg = JSON.parse((await readFile(pkgFile, "utf8")) as string) as { name?: string; scripts?: Record<string, string> };
      return {
        root,
        packages: [
          {
            relativePath: ".",
            absPath: root,
            name: pkg.name ?? path.basename(root),
            scripts: pkg.scripts,
          },
        ],
      };
    }
    return { root: path.resolve(startDir), packages: [] };
  }

  const abs = expandPatterns(root, patterns);
  const packages: WorkspacePackage[] = [];
  for (const absPath of abs) {
    const pkg = JSON.parse((await readFile(path.join(absPath, "package.json"), "utf8")) as string) as {
      name?: string;
      scripts?: Record<string, string>;
    };
    packages.push({
      relativePath: path.relative(root, absPath),
      absPath,
      name: pkg.name ?? path.basename(absPath),
      scripts: pkg.scripts,
    });
  }
  return { root, packages };
}
