"use client";

import { useEffect, useState } from "react";
import type { ContainerStats } from "@/lib/docker/stats";

export function useContainerStats(containerId: string | null): {
  stats: ContainerStats | null;
  connected: boolean;
} {
  const [stats, setStats] = useState<ContainerStats | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!containerId) return;

    const es = new EventSource(`/api/containers/${containerId}/stats`);

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        setStats(JSON.parse(e.data) as ContainerStats);
      } catch {
        // Skip malformed
      }
    };
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
    };
  }, [containerId]);

  return { stats, connected };
}
