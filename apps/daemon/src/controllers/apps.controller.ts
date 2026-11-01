import { Body, Controller, Get, HttpException, HttpStatus, Param, Post } from "@nestjs/common";
import type { StartAppRequest } from "@portless/core";
import { AppsService } from "../engine/apps.service.js";
import type { ListAppsResponse, StartAppResponse, StopAppResponse } from "@portless/contracts";

@Controller("api/v1/apps")
export class AppsController {
  constructor(private readonly apps: AppsService) {}

  @Get()
  async list(): Promise<ListAppsResponse> {
    await this.apps.reconcile();
    return { apps: this.apps.list() };
  }

  @Post()
  async start(@Body() body: StartAppRequest): Promise<StartAppResponse> {
    try {
      return await this.apps.start(body);
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.BAD_REQUEST);
    }
  }

  @Post(":id/stop")
  async stop(@Param("id") id: string): Promise<StopAppResponse> {
    const ok = await this.apps.stop(id);
    return { ok };
  }
}
