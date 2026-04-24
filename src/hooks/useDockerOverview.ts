"use client";

import { useEffect, useState } from "react";
import type { DockerOverview } from "@/lib/docker/stats";

export function useDockerOverview(): {
  overview: DockerOverview | null;
  connected: boolean;
} {
  const [overview, setOverview] = useState<DockerOverview | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const es = new EventSource("/api/docker/stats/stream");

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        setOverview(JSON.parse(e.data) as DockerOverview);
      } catch {
        // Skip malformed
      }
    };
    es.onerror = () => setConnected(false);

    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  return { overview, connected };
}
