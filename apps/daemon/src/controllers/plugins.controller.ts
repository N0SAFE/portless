import { Controller, Get, Inject } from "@nestjs/common";
import { ProviderRegistry } from "@portless/core";
import type { ListPluginsResponse } from "@portless/contracts";
import { PROVIDER_REGISTRY } from "../tokens.js";

@Controller("api/v1/plugins")
export class PluginsController {
  constructor(@Inject(PROVIDER_REGISTRY) private readonly providers: ProviderRegistry) {}

  @Get()
  async list(): Promise<ListPluginsResponse> {
    const infos = this.providers.all().map((p) => p.info);
    return { providers: infos };
  }
}
