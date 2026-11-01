/**
 * release — build the portless CLI into a self-contained `portless` binary and
 * install it to ~/.local/bin (mirrors code_helper's release pipeline).
 *
 *   bun run scripts/release.ts   # or: bun run build && install
 */
import { $ } from "bun";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const INSTALL_DIR = path.join(homedir(), ".local", "bin");
const BACKUP_DIR = path.join(homedir(), ".local", "bin", "backups");

console.log("→ type-checking…");
await $`bun run type-check`;

console.log("→ building the CLI binary…");
await $`bun build ./apps/cli/src/main.ts --target=bun --outfile ./dist/portless --compile`;

const target = path.join(INSTALL_DIR, "portless");
if (existsSync(target)) {
  console.log("→ backing up existing binary…");
  await $`mkdir -p ${BACKUP_DIR}`;
  await $`cp ${target} ${BACKUP_DIR}/portless_${Date.now()}`;
}

await $`mkdir -p ${INSTALL_DIR}`;
await $`cp ./dist/portless ${target}`;
await $`chmod +x ${target}`;

console.log(`✓ installed portless to ${target}`);
console.log(`  run with: ${target}`);
