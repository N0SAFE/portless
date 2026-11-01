"use client";

import { useEffect, useState } from "react";
import type { DaemonEvent } from "@portless/core";

/**
 * Client component that streams daemon events over SSE and renders them live.
 * Reconnects automatically if the connection drops.
 */
export function LiveEvents() {
  const [events, setEvents] = useState<DaemonEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const base =
      process.env.NEXT_PUBLIC_PORTLESS_DAEMON_URL ?? `http://127.0.0.1:${process.env.NEXT_PUBLIC_PORTLESS_DAEMON_PORT ?? 4711}`;
    let es: EventSource | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      es = new EventSource(`${base}/api/v1/events`);
      es.onopen = () => setConnected(true);
      es.onerror = () => {
        setConnected(false);
        es?.close();
        retry = setTimeout(connect, 2000);
      };
      es.onmessage = (msg) => {
        try {
          const event = JSON.parse(msg.data) as DaemonEvent;
          setEvents((prev) => [event, ...prev].slice(0, 50));
        } catch {
          /* ignore malformed */
        }
      };
    };
    connect();
    return () => {
      es?.close();
      if (retry) clearTimeout(retry);
    };
  }, []);

  return (
    <div>
      <p className="muted" style={{ marginTop: 0 }}>
        {connected ? "● connected" : "○ disconnected — retrying…"}
      </p>
      <div className="events">
        {events.length === 0 && <p className="muted">Waiting for events…</p>}
        {events.map((e, i) => (
          <pre key={i}>{JSON.stringify(e)}</pre>
        ))}
      </div>
    </div>
  );
}
