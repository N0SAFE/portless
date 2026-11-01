import pc from "picocolors";

/**
 * CLI output helpers.
 *
 * Discipline (mirrors code_helper): stdout = machine-readable data, stderr =
 * human UI/logging, so `portless list | jq` and agent parsing work cleanly.
 */

export const ui = {
  log: (msg = ""): void => {
    process.stdout.write(`${msg}\n`);
  },
  data: (json: unknown): void => {
    process.stdout.write(`${JSON.stringify(json, null, 2)}\n`);
  },
  info: (msg: string): void => {
    process.stderr.write(`${pc.cyan("portless")} ${pc.dim("·")} ${msg}\n`);
  },
  success: (msg: string): void => {
    process.stderr.write(`${pc.green("✓")} ${msg}\n`);
  },
  warn: (msg: string): void => {
    process.stderr.write(`${pc.yellow("!")} ${msg}\n`);
  },
  error: (msg: string): void => {
    process.stderr.write(`${pc.red("✗")} ${msg}\n`);
  },
  url: (u: string): string => pc.underline(pc.cyan(u)),
};
