import { z } from "zod";

/**
 * Portless configuration schema (global + per-project).
 *
 * Global  -> ~/.portless/config.json
 * Project -> portless.json  or  package.json#portless
 *
 * Rules:
 * - The GLOBAL schema allows all top-level runtime settings.
 * - The PROJECT schema allows the same plus `apps` (monorepo overrides) and
 *   `compose`, and permits a shorthand string form in package.json#portless
 *   (a string is shorthand for { "name": <string> }).
 */

export const providerConfigSchema = z.object({
  enabled: z.boolean().optional(),
  bin: z.string().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;

export const globalConfigSchema = z.object({
  version: z.literal(1).default(1),
  tld: z.string().default("localhost"),
  tls: z.boolean().default(true),
  port: z.number().int().positive().optional(),
  lan: z.boolean().default(false),
  lanIp: z.string().optional(),
  wildcard: z.boolean().default(false),
  syncHosts: z.boolean().default(true),
  daemonPort: z.number().int().positive().optional(),
  daemonToken: z.string().optional(),
  defaultProvider: z.string().default("process"),
  caDir: z.string().optional(),
  stateDir: z.string().optional(),
  providers: z.record(z.string(), providerConfigSchema).optional(),
  env: z.record(z.string(), z.string()).optional(),
  /** Named per-project env profiles, selectable via portless --env <name>. */
  envProfiles: z.record(z.string(), z.record(z.string(), z.string())).optional(),
});
export type GlobalConfig = z.infer<typeof globalConfigSchema>;

export const appEntrySchema = z.object({
  name: z.string().optional(),
  script: z.string().optional(),
  appPort: z.number().int().optional(),
  proxy: z.boolean().optional(),
  provider: z.string().optional(),
  compose: z
    .object({
      file: z.string().optional(),
      services: z.array(z.string()).optional(),
    })
    .optional(),
  env: z.record(z.string(), z.string()).optional(),
});
export type AppEntry = z.infer<typeof appEntrySchema>;

export const projectConfigSchema = z.object({
  version: z.literal(1).optional(),
  name: z.string().optional(),
  script: z.string().optional(),
  appPort: z.number().int().optional(),
  proxy: z.boolean().optional(),
  provider: z.string().optional(),
  compose: z
    .object({
      file: z.string().optional(),
      services: z.array(z.string()).optional(),
    })
    .optional(),
  env: z.record(z.string(), z.string()).optional(),
  /** Monorepo overrides, keyed by workspace package relative path. */
  apps: z.record(z.string(), appEntrySchema).optional(),
  turbo: z.boolean().optional(),
});
export type ProjectConfig = z.infer<typeof projectConfigSchema>;
