import { Injectable } from "@nestjs/common";
import type { DaemonEvent } from "@portless/core";

type Listener = (event: DaemonEvent) => void;

/**
 * In-process event bus that fans daemon events out to SSE subscribers
 * (dashboard, CLI watch, agents). Simple emit/subscribe; no need for a heavier
 * broker at this scale.
 */
@Injectable()
export class EventsService {
  private readonly listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: DaemonEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        /* subscriber error ignored */
      }
    }
  }

  /** Build an SSE body string for an event. */
  static encode(event: DaemonEvent): string {
    return `data: ${JSON.stringify(event)}\n\n`;
  }
}
