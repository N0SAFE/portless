import { Controller, Get, Post } from "@nestjs/common";
import { HostsService } from "../hosts/hosts.service.js";
import type { HostsResponse, HostsSyncResponse } from "@portless/contracts";

@Controller("api/v1/hosts")
export class HostsController {
  constructor(private readonly hosts: HostsService) {}

  @Get()
  async list(): Promise<HostsResponse> {
    const all = await this.hosts.collectHosts();
    return { hosts: all.map((host) => ({ host, ip: "127.0.0.1" })) };
  }

  @Post("sync")
  async sync(): Promise<HostsSyncResponse> {
    const synced = await this.hosts.sync();
    return { ok: true, synced };
  }

  @Post("clean")
  async clean(): Promise<HostsSyncResponse> {
    const removed = await this.hosts.clean();
    return { ok: true, synced: removed };
  }
}
