import { Injectable, Logger } from "@nestjs/common";
import { existsSync } from "node:fs";
import { LocalCa, portlessPaths } from "@portless/core";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CertsStatus {
  caInstalled: boolean;
  caPath?: string;
  trustStoreAttempted?: boolean;
  trustStoreOk?: boolean;
}

/**
 * Reports on and manipulates the local CA: generates it on demand and adds it
 * to the OS trust store (the `portless trust` behaviour) via platform tools.
 */
@Injectable()
export class CertsService {
  private readonly logger = new Logger(CertsService.name);
  private readonly ca: LocalCa;

  constructor() {
    this.ca = new LocalCa(process.env.PORTLESS_STATE_DIR);
  }

  status(): CertsStatus {
    const p = portlessPaths(process.env);
    return { caInstalled: existsSync(p.certFile), caPath: p.certFile };
  }

  async ensure(): Promise<{ cert: string; key: string }> {
    return this.ca.ensureCa();
  }

  /** Best-effort add CA to the system trust store. May require sudo. */
  async trust(): Promise<CertsStatus> {
    await this.ca.ensureCa();
    const p = portlessPaths(process.env);
    const certFile = p.certFile;
    let ok = false;
    try {
      if (process.platform === "darwin") {
        await execFileAsync("security", ["add-trusted-cert", "-d", "-r", "trustRoot", "-k", "/Library/Keychains/System.keychain", certFile]);
        ok = true;
      } else if (process.platform === "linux") {
        // Debian/Ubuntu, Fedora/RHEL, Arch, openSUSE
        const dir = "/usr/local/share/ca-certificates";
        if (existsSync("/etc/arch-release")) {
          await execFileAsync("install", ["-D", "-m", "644", certFile, "/etc/ca-certificates/trust-source/anchors/portless-ca.pem"]);
          await execFileAsync("update-ca-trust", []);
          ok = true;
        } else if (existsSync("/etc/debian_version")) {
          if (!existsSync(dir)) await execFileAsync("mkdir", ["-p", dir]);
          await execFileAsync("cp", [certFile, "/usr/local/share/ca-certificates/portless-ca.crt"]);
          await execFileAsync("update-ca-certificates", []);
          ok = true;
        } else if (existsSync("/etc/redhat-release") || existsSync("/etc/fedora-release")) {
          await execFileAsync("install", ["-D", "-m", "644", certFile, "/etc/pki/ca-trust/source/anchors/portless-ca.pem"]);
          await execFileAsync("update-ca-trust", []);
          ok = true;
        } else {
          // openSUSE
          await execFileAsync("install", ["-D", "-m", "644", certFile, "/etc/pki/trust/anchors/portless-ca.pem"]);
          await execFileAsync("update-ca-certificates", []);
          ok = true;
        }
      } else {
        this.logger.warn("Trust store update not implemented on this platform");
      }
    } catch (err) {
      this.logger.error(`trust failed: ${(err as Error).message}`);
      ok = false;
    }
    this.logger.log(`CA trust: ${ok ? "ok" : "failed (may need sudo)"}`);
    return { caInstalled: true, caPath: certFile, trustStoreAttempted: true, trustStoreOk: ok };
  }
}
