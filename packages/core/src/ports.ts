import net from "node:net";
import { PORTLESS_PORT_MAX, PORTLESS_PORT_MIN } from "./types.js";

/**
 * Allocate a free ephemeral port in the portless range (4000-4999).
 *
 * The returned port is released before being handed back, so there is a
 * (small) race between allocation and the child binding it — acceptable for
 * local dev tooling, and matches vercel-labs/portless. Callers that need a
 * fixed port should pass it explicitly.
 */
export function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export async function allocateFreePort(
  preferred?: number,
  min = PORTLESS_PORT_MIN,
  max = PORTLESS_PORT_MAX,
): Promise<number> {
  if (preferred !== undefined) {
    if (await isPortFree(preferred)) return preferred;
    throw new Error(`Requested port ${preferred} is not available.`);
  }

  // Deterministic-ish scan starting from a semi-random offset to reduce the
  // chance of two daemons picking the same port simultaneously.
  const offset = Math.floor(Math.random() * (max - min + 1));
  for (let step = 0; step <= max - min; step++) {
    const candidate = min + ((offset + step) % (max - min + 1));
    if (await isPortFree(candidate)) return candidate;
  }
  throw new Error(`No free port in range ${min}-${max}.`);
}
