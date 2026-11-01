import { Module } from "@nestjs/common";
import { ProviderRegistry } from "@portless/core";
import { loadConfig, type GlobalConfig } from "@portless/config";
import { buildDefaultRegistry } from "@portless/providers";

import { EventsService } from "./events/events.service.js";
import { RoutesService } from "./engine/routes.service.js";
import { AppsService } from "./engine/apps.service.js";
import { RuntimeService } from "./engine/runtime.service.js";
import { HostsService } from "./hosts/hosts.service.js";
import { CertsService } from "./certs/certs.service.js";
import { ConfigService } from "./config/config.service.js";
import { DaemonSettingsService } from "./settings/daemon-settings.service.js";

import { HealthController } from "./controllers/health.controller.js";
import { RoutesController } from "./controllers/routes.controller.js";
import { AppsController } from "./controllers/apps.controller.js";
import { ProjectsController } from "./controllers/projects.controller.js";
import { HostsController } from "./controllers/hosts.controller.js";
import { ConfigController } from "./controllers/config.controller.js";
import { PluginsController } from "./controllers/plugins.controller.js";
import { CertsController } from "./controllers/certs.controller.js";
import { EventsController } from "./controllers/events.controller.js";
import { ProxyController } from "./controllers/proxy.controller.js";
import { PROVIDER_REGISTRY } from "./tokens.js";

function createRegistryFactory() {
  return {
    provide: PROVIDER_REGISTRY,
    useFactory: async (): Promise<ProviderRegistry> => {
      const { global } = await loadConfig();
      return buildDefaultRegistry(global as GlobalConfig);
    },
  };
}

@Module({
  controllers: [
    HealthController,
    RoutesController,
    AppsController,
    ProjectsController,
    HostsController,
    ConfigController,
    PluginsController,
    CertsController,
    EventsController,
    ProxyController,
  ],
  providers: [
    createRegistryFactory(),
    EventsService,
    RoutesService,
    AppsService,
    RuntimeService,
    HostsService,
    CertsService,
    ConfigService,
    DaemonSettingsService,
  ],
  exports: [EventsService, RoutesService, RuntimeService],
})
export class DaemonModule {}
