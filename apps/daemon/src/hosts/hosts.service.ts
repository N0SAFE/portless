import { Injectable, Logger } from "@nestjs/common";
import { promises as fs } from "node:fs";
import { portlessPaths } from "@portless/core";
import { RoutesService } from "../engine/routes.service.js";

const HOSTS_PATH = "/etc/hosts";
const MARKER_START = "# >>> portless start >>>";
const MARKER_END = "# <<< portless end <<<";
const LOOPBACK = "127.0.0.1";

/**
 * Manages the portless block in /etc/hosts so named routes resolve on the
 * machine (needed for custom TLDs and Safari). Auto-syncs on route changes.
 */
@Injectable()
export class HostsService {
  private readonly logger = new Logger(HostsService.name);

  constructor(private readonly routes: RoutesService) {}

  collectHosts(): string[] {
    return this.routes
      .all()
      .map((r) => r.host)
      .filter((h, i, arr) => arr.indexOf(h) === i)
      .sort();
  }

  async read(): Promise<string> {
    try {
      return await fs.readFile(HOSTS_PATH, "utf8");
    } catch {
      return "";
    }
  }

  private buildBlock(hosts: string[]): string {
    const lines = hosts.map((h) => `${LOOPBACK} ${h}`);
    return `${MARKER_START}\n${lines.join("\n")}\n${MARKER_END}`;
  }

  private stripBlock(content: string): string {
    const start = content.indexOf(MARKER_START);
    const end = content.indexOf(MARKER_END);
    if (start < 0 || end < 0) return content;
    const before = content.slice(0, start).replace(/\n+$/, "");
    const after = content.slice(end + MARKER_END.length).replace(/^\n+/, "");
    return `${before}\n${after}`.replace(/\n{3,}/g, "\n\n");
  }

  async sync(): Promise<number> {
    const hosts = this.collectHosts();
    if (hosts.length === 0) return 0;
    const content = await this.read();
    const stripped = this.stripBlock(content);
    const block = this.buildBlock(hosts);
    const next = `${stripped.replace(/\n+$/, "")}\n${block}\n`;
    await fs.writeFile(HOSTS_PATH, next, "utf8");
    this.logger.log(`synced ${hosts.length} host entries`);
    return hosts.length;
  }

  async clean(): Promise<number> {
    const content = await this.read();
    const next = this.stripBlock(content);
    if (next !== content) {
      await fs.writeFile(HOSTS_PATH, next, "utf8");
    }
    return this.collectHosts().length;
  }

  isWritable(): boolean {
    return true; // checked at write time; errors surface in controller
  }
}

export { portlessPaths };
