/**
 * portless CLI — production entrypoint.
 *
 * Boots the NestJS application context and hands control to nest-commander
 * (which wraps commander). The CLI is a thin client over the daemon control
 * plane; if the daemon is not running it is started transparently.
 *
 * IMPORTANT: nest-commander's `CommandFactory.run` resolves once the command
 * action finishes. We therefore flush pending output and explicitly exit so
 * interactive commands (prompts, SSE watches) don't keep the event loop alive.
 */
import "reflect-metadata";
import { CommandFactory } from "nest-commander";
import pc from "picocolors";
import { AppModule } from "./app.module.js";
import { CLI_NAME, VERSION } from "./common/cli-config.js";

/** Flush pending stdout/stderr writes, then exit with `code`. */
function flushAndExit(code: number): void {
  const streams = [process.stdout, process.stderr].filter((s) => s.writableLength > 0);
  if (streams.length === 0) {
    process.exit(code);
    return;
  }
  let pending = streams.length;
  for (const s of streams) {
    s.once("drain", () => {
      pending -= 1;
      if (pending === 0) process.exit(code);
    });
  }
}

let exiting = false;

/** Terminate the process once, regardless of how many paths trigger it. */
function terminate(code: number): void {
  if (exiting) return;
  exiting = true;
  flushAndExit(code);
}

// Global safety nets.
process.on("unhandledRejection", (reason) => {
  process.stderr.write(`${pc.red("[FATAL]")} Unhandled rejection: ${(reason as Error)?.message ?? reason}\n`);
  terminate(1);
});
process.on("uncaughtException", (err) => {
  process.stderr.write(`${pc.red("[FATAL]")} Uncaught exception: ${err.message}\n`);
  terminate(1);
});

async function bootstrap(): Promise<void> {
  await CommandFactory.run(AppModule, {
    cliName: CLI_NAME,
    version: VERSION,
    logger: ["warn", "error"],
    serviceErrorHandler: (err) => {
      process.stderr.write(`${pc.red("[ERROR]")} ${(err as Error).message}\n`);
      terminate(1);
    },
    usePlugins: false,
    enablePositionalOptions: false,
  });
  terminate(0);
}

void bootstrap().catch((err: Error) => {
  process.stderr.write(`${pc.red("[FATAL]")} ${err.message}\n`);
  terminate(1);
});
