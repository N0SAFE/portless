/**
 * Builds the `portless` binary with bun (mirrors code_helper's release flow).
 * Output: dist/portless (self-contained executable).
 */
import { $ } from "bun";
import { mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });

console.log("→ compiling portless CLI…");
await $`bun build ./src/main.ts --target=bun --outfile dist/portless.js`;

console.log("✓ built dist/portless.js");
console.log("  run with: bun run dist/portless.js");
console.log("  (optionally compile to a single binary with `bun build --compile`)");
