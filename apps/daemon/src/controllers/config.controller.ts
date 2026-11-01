import { Body, Controller, Get, Put } from "@nestjs/common";
import { ConfigService } from "../config/config.service.js";
import type { GetConfigResponse, UpdateConfigRequest, UpdateConfigResponse } from "@portless/contracts";

@Controller("api/v1/config")
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  async get(): Promise<GetConfigResponse> {
    return this.config.read();
  }

  @Put()
  async update(@Body() body: UpdateConfigRequest): Promise<UpdateConfigResponse> {
    const global = await this.config.update(body.patch, body.scope);
    return { ok: true, global };
  }
}
