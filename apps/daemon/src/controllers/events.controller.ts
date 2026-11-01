import { Controller, Sse } from "@nestjs/common";
import { Observable, fromEventPattern } from "rxjs";
import type { DaemonEvent } from "@portless/core";
import { EventsService } from "../events/events.service.js";

/**
 * Server-Sent Events stream for the dashboard / CLI watch / agents.
 * Emits every daemon event (app/route/proxy/config/provider changes).
 */
@Controller("api/v1/events")
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Sse()
  stream(): Observable<{ data: DaemonEvent }> {
    return fromEventPattern<{ data: DaemonEvent }>(
      (handler) => {
        const unsub = this.events.subscribe((event) => {
          handler({ data: event });
        });
        return unsub;
      },
      (_handler, unsub) => {
        (unsub as () => void)?.();
      },
    );
  }
}
