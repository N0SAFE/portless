import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { existsSync } from "node:fs";
import { portlessPaths } from "./paths.js";

const execFileAsync = promisify(execFile);

/**
 * Local Certificate Authority helpers.
 *
 * Backed by `openssl`, which is present on essentially every dev machine that
 * runs portless. Generates a self-signed CA on first run and issues per-host
 * server certificates signed by it. The CA is added to the system trust store
 * by `portless trust`.
 */
export class LocalCa {
  private readonly dir: string;
  private readonly caFile: string;
  private readonly caKeyFile: string;

  constructor(stateDir?: string) {
    const p = portlessPaths(stateDir ? { PORTLESS_STATE_DIR: stateDir } : undefined);
    this.dir = path.dirname(p.certFile);
    this.caFile = p.certFile;
    this.caKeyFile = p.certKeyFile;
  }

  private async openssl(args: string[]): Promise<string> {
    const { stdout } = await execFileAsync("openssl", args, { maxBuffer: 10 * 1024 * 1024 });
    return stdout;
  }

  async ensureCa(): Promise<{ cert: string; key: string }> {
    if (existsSync(this.caFile) && existsSync(this.caKeyFile)) {
      return {
        cert: await readFile(this.caFile, "utf8"),
        key: await readFile(this.caKeyFile, "utf8"),
      };
    }
    await mkdir(this.dir, { recursive: true });

    // Per-thread randomness & strong RSA key.
    await this.openssl([
      "genrsa",
      "-out",
      this.caKeyFile,
      "3072",
    ]);
    await this.openssl([
      "req",
      "-x509",
      "-new",
      "-key",
      this.caKeyFile,
      "-sha256",
      "-days",
      "825",
      "-out",
      this.caFile,
      "-subj",
      "/CN=Portless Local CA/O=Portless",
      "-addext",
      "basicConstraints=critical,CA:TRUE",
      "-addext",
      "keyUsage=critical,keyCertSign,cRLSign",
    ]);
    return {
      cert: await readFile(this.caFile, "utf8"),
      key: await readFile(this.caKeyFile, "utf8"),
    };
  }

  /**
   * Issue a server certificate for the given hosts (SANs). Caches per host on
   * disk so restarts reuse the same cert.
   */
  async issueCert(hosts: string[]): Promise<{ cert: string; key: string } | null> {
    await this.ensureCa();
    const slug = hosts.join("_").replace(/[^a-z0-9_.-]/gi, "_");
    const certFile = path.join(this.dir, `cert-${slug}.pem`);
    const keyFile = path.join(this.dir, `key-${slug}.pem`);
    if (existsSync(certFile) && existsSync(keyFile)) {
      return { cert: await readFile(certFile, "utf8"), key: await readFile(keyFile, "utf8") };
    }

    const csrFile = path.join(this.dir, `csr-${slug}.pem`);
    const extFile = path.join(this.dir, `ext-${slug}.cnf`);
    const defaultSans = ["DNS:localhost", "DNS:*.localhost"]
      .concat(hosts.map((h) => `DNS:${h}`))
      .join(", ");
    // Build a config so SANs apply to the CSR too.
    const conf = [
      "[req]",
      "distinguished_name = dn",
      "req_extensions = req_ext",
      "prompt = no",
      "[dn]",
      "CN = portless-cert",
      "[req_ext]",
      `subjectAltName = ${defaultSans}`,
    ].join("\n");
    await writeFile(extFile, conf, "utf8");

    await this.openssl(["req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", keyFile, "-out", csrFile, "-subj", "/CN=portless-cert", "-config", extFile]);
    // Copy conf + set extend for signing.
    const signConf = [
      "[v3_ca]",
      `subjectAltName = ${defaultSans}`,
      "basicConstraints = CA:FALSE",
      "keyUsage = digitalSignature,keyEncipherment",
      "extendedKeyUsage = serverAuth",
    ].join("\n");
    const signFile = path.join(this.dir, `sign-${slug}.cnf`);
    await writeFile(signFile, signConf, "utf8");

    await this.openssl([
      "x509",
      "-req",
      "-in",
      csrFile,
      "-CA",
      this.caFile,
      "-CAkey",
      this.caKeyFile,
      "-CAcreateserial",
      "-out",
      certFile,
      "-days",
      "795",
      "-sha256",
      "-extfile",
      signFile,
      "-extensions",
      "v3_ca",
    ]);
    return {
      cert: await readFile(certFile, "utf8"),
      key: await readFile(keyFile, "utf8"),
    };
  }

  get caPath(): string {
    return this.caFile;
  }
}
