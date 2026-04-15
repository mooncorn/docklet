"use client";

import { useState, useEffect, useRef, useCallback } from "react";

const MAX_LOG_LINES = 5000;

export function useContainerLogs(
  containerId: string | null,
  opts: { tail?: number } = {}
) {
  const [logs, setLogs] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const [reconnectTick, setReconnectTick] = useState(0);
  const reconnect = useCallback(() => setReconnectTick((t) => t + 1), []);
  const clear = useCallback(() => setLogs([]), []);

  useEffect(() => {
    if (!containerId) return;
    const tail = opts.tail ?? 200;
    const es = new EventSource(
      `/api/containers/${containerId}/logs?tail=${tail}`
    );
    eventSourceRef.current = es;

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const line = JSON.parse(e.data);
        setLogs((prev) => {
          const next = [...prev, line];
          return next.length > MAX_LOG_LINES
            ? next.slice(next.length - MAX_LOG_LINES)
            : next;
        });
      } catch {
        // Skip malformed messages
      }
    };
    es.onerror = () => {
      setConnected(false);
      es.close();
      eventSourceRef.current = null;
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [containerId, opts.tail, reconnectTick]);

  return { logs, connected, clear, reconnect };
}
