import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post } from "@nestjs/common";
import type { AliasRoute, Route } from "@portless/core";
import { RoutesService } from "../engine/routes.service.js";
import { EventsService } from "../events/events.service.js";
import { HostsService } from "../hosts/hosts.service.js";
import type { AddRouteRequest, AddRouteResponse, ListRoutesResponse, RemoveRouteResponse } from "@portless/contracts";

@Controller("api/v1/routes")
export class RoutesController {
  constructor(
    private readonly routes: RoutesService,
    private readonly events: EventsService,
    private readonly hosts: HostsService,
  ) {}

  @Get()
  list(): ListRoutesResponse {
    return { routes: this.routes.all() };
  }

  @Post()
  add(@Body() body: AddRouteRequest): AddRouteResponse {
    const alias: AliasRoute = {
      host: body.host,
      target: body.target,
      force: body.force,
    };
    let route: Route;
    try {
      route = this.routes.addAlias(alias, body.force ?? false);
    } catch (err) {
      throw new HttpException((err as Error).message, HttpStatus.CONFLICT);
    }
    this.events.emit({ type: "route.added", route });
    // Best-effort hosts sync.
    if (process.env.PORTLESS_SYNC_HOSTS !== "0") {
      void this.hosts.sync().catch(() => undefined);
    }
    return { route };
  }

  @Delete(":host")
  remove(@Param("host") host: string): RemoveRouteResponse {
    const removed = this.routes.remove(host);
    if (removed) this.events.emit({ type: "route.removed", host });
    return { ok: true, removed: Boolean(removed) };
  }
}
