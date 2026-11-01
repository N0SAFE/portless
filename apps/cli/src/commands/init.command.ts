import { Command, CommandRunner, Option } from "nest-commander";
import { promises as fs } from "node:fs";
import path from "node:path";
import { findPackageJson } from "@portless/config";
import { ui } from "../common/ui.js";
import { projectName } from "./run.command.js";

interface InitOptions {
  name?: string;
  force?: boolean;
}

/**
 * `portless init` — scaffold a `portless.json` in the current project,
 * inferring the app name from package.json (or the directory).
 */
@Command({ name: "init", description: "Scaffold a portless.json in this project" })
export class InitCommand extends CommandRunner {
  @Option({ flags: "-n, --name <name>", description: "App name (default: inferred)" })
  parseName(val: string): string {
    return val;
  }

  @Option({ flags: "-f, --force", description: "Overwrite an existing portless.json" })
  parseForce(val: boolean): boolean {
    return val;
  }

  async run(_params: string[], options?: InitOptions): Promise<void> {
    const file = path.join(process.cwd(), "portless.json");
    const exists = await fs
      .access(file)
      .then(() => true)
      .catch(() => false);
    if (exists && !options?.force) {
      ui.warn("portless.json already exists (use --force to overwrite)");
      process.exitCode = 1;
      return;
    }
    const pkgFile = findPackageJson(process.cwd());
    const pkg = pkgFile
      ? (JSON.parse(await fs.readFile(pkgFile, "utf8").catch(() => "{}")) as Record<string, unknown>)
      : undefined;
    const name = options?.name ?? projectName(pkg as Record<string, unknown> | undefined) ?? path.basename(process.cwd());

    const content = {
      name,
      script: "dev",
      provider: "process",
      env: {},
    };
    await fs.writeFile(file, JSON.stringify(content, null, 2) + "\n", "utf8");
    ui.success(`created ${file}`);
    ui.info(`run \`portless\` to start "${name}" through the proxy`);
  }
}
