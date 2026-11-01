import { Controller, Get } from "@nestjs/common";
import { RuntimeService } from "../engine/runtime.service.js";
import type { HealthResponse } from "@portless/contracts";

@Controller("api/v1/health")
export class HealthController {
  constructor(private readonly runtime: RuntimeService) {}

  @Get()
  health(): HealthResponse {
    const settings = this.runtime.currentSettings;
    return {
      ok: true,
      service: "portless-daemon",
      version: process.env.npm_package_version ?? "0.1.0",
      uptimeMs: process.uptime() * 1000,
      proxy: {
        running: this.runtime.running,
        port: settings?.port,
        tls: settings?.tls,
      },
    };
  }
}
