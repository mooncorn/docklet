"use client";

import { useEffect, useRef, useCallback } from "react";
import type { DockerEvent } from "@/lib/docker/types";

export function useDockerEvents(onEvent: (event: DockerEvent) => void) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const backoffRef = useRef(1000);

  const connect = useCallback(() => {
    if (eventSourceRef.current) return;

    const es = new EventSource("/api/events");
    eventSourceRef.current = es;

    es.onmessage = (e) => {
      backoffRef.current = 1000; // Reset backoff on successful message
      try {
        const event: DockerEvent = JSON.parse(e.data);
        onEvent(event);
      } catch {
        // Skip malformed events
      }
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      // Reconnect with backoff
      reconnectTimeoutRef.current = setTimeout(() => {
        backoffRef.current = Math.min(backoffRef.current * 2, 30000);
        connect();
      }, backoffRef.current);
    };
  }, [onEvent]);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimeoutRef.current);
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
  }, []);

  useEffect(() => {
    connect();
    return disconnect;
  }, [connect, disconnect]);

  return { disconnect };
}
