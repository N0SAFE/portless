import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { Duplex } from "node:stream";
import tls from "node:tls";
import type { Route } from "../types.js";
import { LocalCa } from "../ca.js";

/**
 * The portless HTTP(S) reverse proxy.
 *
 * Routes by `Host` header (HTTP/1.1) or SNI/`:authority` (HTTP/2 via ALPN) to
 * registered targets. Supports WebSocket upgrades for HMR.
 *
 * TLS termination uses a local CA (see `LocalCa`) to sign per-host certs on
 * demand, so every `<name>.localhost` URL gets a valid cert with zero setup.
 *
 * This is the primary proxy path for web apps/dev servers. Arbitrary-TCP and
 * TLS-SNI routing for non-HTTP protocols (Postgres, Redis, …) is provided by
 * `createTcpProxy` (dockportless-style), not here.
 */

export interface ProxyRouter {
  (host: string): Route | undefined;
}

export interface ProxyServerOptions {
  port: number;
  tls: boolean;
  ca?: LocalCa;
  cert?: string;
  key?: string;
  router: ProxyRouter;
  listenerHost?: string;
}

export interface ProxyServerHandle {
  readonly running: boolean;
  readonly port: number;
  readonly tls: boolean;
  start(): Promise<void>;
  stop(): Promise<void>;
}

function connectTarget(
  target: string,
  onError: (err: Error) => void,
): net.Socket {
  const idx = target.lastIndexOf(":");
  const host = target.slice(0, idx) || "127.0.0.1";
  const port = Number(target.slice(idx + 1)) || 80;
  const socket = net.connect({ host, port });
  socket.on("error", onError);
  return socket;
}

export function createProxyServer(opts: ProxyServerOptions): ProxyServerHandle {
  let running = false;
  let server: http.Server | https.Server | undefined;

  const resolve = (host: string): Route | undefined => opts.router(host);

  const handleRequest = (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void => {
    const host = (req.headers.host ?? "").split(":")[0];
    const route = resolve(host);
    if (!route) {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end(`portless: no route for host "${host}"\n`);
      return;
    }
    if (route.protocol === "tcp") {
      res.writeHead(502, { "content-type": "text/plain" });
      res.end(`portless: "${host}" is a TCP route, not HTTP\n`);
      return;
    }
    const target = connectTarget(route.target, (err) => {
      if (!res.headersSent) {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end(`portless: cannot reach ${route.target}: ${err.message}\n`);
      } else {
        res.destroy();
      }
    });
    const proxyReq = http.request({
      path: req.url,
      method: req.method,
      headers: { ...req.headers },
      createConnection: () => target,
    });
    proxyReq.on("error", (err) => res.destroy(err));
    proxyReq.on("response", (upRes) => {
      res.writeHead(upRes.statusCode ?? 502, upRes.headers);
      upRes.pipe(res);
    });
    req.pipe(proxyReq);
  };

  const handleUpgrade = (
    req: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void => {
    const host = (req.headers.host ?? "").split(":")[0];
    const route = resolve(host);
    if (!route) {
      socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
      return;
    }
    if (route.protocol === "tcp") {
      socket.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
      return;
    }
    const target = connectTarget(route.target, () => socket.destroy());
    socket.on("error", () => target.destroy());
    target.on("error", () => socket.destroy());
    const headBuf = Buffer.isBuffer(head) ? head : Buffer.alloc(0);
    let data = `${req.method} ${req.url} HTTP/1.1\r\n`;
    for (const [k, v] of Object.entries(req.headers)) {
      const low = k.toLowerCase();
      if (low === "connection" || low === "upgrade") continue;
      const val = Array.isArray(v) ? v.join(", ") : v;
      data += `${k}: ${val}\r\n`;
    }
    data += "Connection: Upgrade\r\nUpgrade: websocket\r\n\r\n";
    target.write(data);
    if (headBuf.length > 0) target.write(headBuf);
    socket.pipe(target).pipe(socket);
  };

  return {
    get running() {
      return running;
    },
    get port() {
      return opts.port;
    },
    get tls() {
      return opts.tls;
    },
    async start() {
      if (running) return;
      const listenerHost = opts.listenerHost ?? "127.0.0.1";

      if (opts.tls) {
        server = https.createServer(
          {
            SNICallback: (servername, cb) => {
              if (opts.cert && opts.key) {
                cb(null, tls.createSecureContext({ cert: opts.cert, key: opts.key }));
                return;
              }
              if (!opts.ca) {
                cb(new Error("portless: no CA configured"));
                return;
              }
              void opts.ca
                .issueCert([servername])
                .then((c) => {
                  if (!c) {
                    cb(new Error("portless: cert issuance failed"));
                    return;
                  }
                  cb(null, tls.createSecureContext({ cert: c.cert, key: c.key }));
                })
                .catch((err) => cb(err as Error));
            },
          },
          handleRequest,
        );
      } else {
        server = http.createServer(handleRequest);
      }
      server.on("upgrade", handleUpgrade as never);
      await new Promise<void>((resolve, reject) => {
        server!.on("error", reject);
        server!.listen(opts.port, listenerHost, () => resolve());
      });
      running = true;
    },
    async stop() {
      if (!running) return;
      const s = server;
      server = undefined;
      return new Promise<void>((resolve) => {
        if (!s) return resolve();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (s as any).closeAllConnections?.();
        s.close(() => resolve());
      });
    },
  };
}

/**
 * dockportless-style TCP listener that detects the inbound protocol and routes
 * by SNI/hostname, forwarding arbitrary protocols (HTTPS, Postgres, Redis, …).
 * Restricted to loopback unless explicitly bound wider.
 */
export interface TcpProxyOptions {
  port: number;
  ca?: LocalCa;
  router: (host: string) => Route | undefined;
  listenerHost?: string;
}

export interface TcpProxyHandle {
  readonly running: boolean;
  readonly port: number;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export function createTcpProxy(opts: TcpProxyOptions): TcpProxyHandle {
  let running = false;
  let server: net.Server | undefined;

  const routeByHost = (host: string): Route | undefined => opts.router(host);

  const handleTls = (socket: net.Socket, first?: Buffer): void => {
    const tlsSocket = new tls.TLSSocket(socket, {
      isServer: true,
      secureContext: tls.createSecureContext({}), // replaced via SNI callback
      SNICallback: (servername, cb) => {
        const route = routeByHost(servername);
        if (!route) {
          cb(new Error(`portless: no SNI route for "${servername}"`));
          return;
        }
        if (!opts.ca) {
          cb(new Error("portless: no CA configured"));
          return;
        }
        void opts.ca
          .issueCert([servername])
          .then((c) => {
            if (!c) {
              cb(new Error("portless: cert issuance failed"));
              return;
            }
            cb(null, tls.createSecureContext({ cert: c.cert, key: c.key }));
          })
          .catch((err) => cb(err as Error));
      },
    });
    tlsSocket.on("secure", () => {
      const host = tlsSocket.servername;
      const route = host ? routeByHost(host) : undefined;
      if (!route) {
        tlsSocket.end();
        return;
      }
      const target = connectTarget(route.target, () => tlsSocket.destroy());
      target.on("error", () => tlsSocket.destroy());
      tlsSocket.pipe(target).pipe(tlsSocket);
    });
    tlsSocket.on("error", () => socket.destroy());
    void first;
  };

  const handleConnection = (socket: net.Socket): void => {
    socket.setNoDelay(true);
    socket.once("data", (chunk) => {
      const first = chunk as Buffer;
      // TLS record header: 0x16 0x03 ...
      if (first.length >= 3 && first[0] === 0x16 && first[1] === 0x03) {
        handleTls(socket, first);
        return;
      }
      // PostgreSQL SSLRequest: 8-byte length then int32 code 80877103.
      if (first.length >= 8 && first.readInt32BE(4) === 80877103) {
        socket.write(Buffer.from("S"));
        handleTls(socket);
        return;
      }
      // HTTP: route by Host header.
      const text = first.toString("latin1");
      const m = text.match(/^Host:\s*([^\r\n]+)/im);
      const host = m ? m[1].trim().split(":")[0] : undefined;
      const route = host ? routeByHost(host) : undefined;
      if (!route) {
        socket.end("HTTP/1.1 404 Not Found\r\n\r\n");
        return;
      }
      const target = connectTarget(route.target, () => socket.destroy());
      target.on("error", () => socket.destroy());
      target.write(first);
      socket.pipe(target).pipe(socket);
    });
    socket.on("error", () => undefined);
  };

  return {
    get running() {
      return running;
    },
    get port() {
      return opts.port;
    },
    async start() {
      if (running) return;
      server = net.createServer(handleConnection);
      await new Promise<void>((resolve, reject) => {
        server!.on("error", reject);
        server!.listen(opts.port, opts.listenerHost ?? "127.0.0.1", () => resolve());
      });
      running = true;
    },
    async stop() {
      if (!running) return;
      const s = server;
      server = undefined;
      return new Promise<void>((resolve) => {
        if (!s) return resolve();
        s.close(() => resolve());
      });
    },
  };
}
