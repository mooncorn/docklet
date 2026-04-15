"use client";

import { useEffect, useRef, useState } from "react";
import type { SystemStats } from "@/lib/system/stats";

export function useSystemStats(): { stats: SystemStats | null; connected: boolean } {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/system/stats/stream");
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        setStats(JSON.parse(e.data) as SystemStats);
      } catch {
        // Skip malformed
      }
    };
    es.onerror = () => {
      setConnected(false);
    };

    return () => {
      es.close();
      esRef.current = null;
      setConnected(false);
    };
  }, []);

  return { stats, connected };
}
