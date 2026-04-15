"use client";

import {
  HiOutlineCpuChip,
  HiOutlineCircleStack,
  HiOutlineServerStack,
  HiOutlineCube,
  HiOutlinePhoto,
  HiOutlineClock,
} from "react-icons/hi2";
import { useSystemStats } from "@/hooks/useSystemStats";

export default function DashboardStats() {
  const { stats, connected } = useSystemStats();

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <UsageCard
          icon={<HiOutlineCpuChip className="w-5 h-5" />}
          title="CPU"
          subtitle={stats.cpu.model || `${stats.cpu.cores} cores`}
          percent={stats.cpu.load}
          primaryLabel={`${stats.cpu.load.toFixed(1)}%`}
          secondaryLabel={`${stats.cpu.cores} cores`}
        />
        <UsageCard
          icon={<HiOutlineCircleStack className="w-5 h-5" />}
          title="Memory"
          subtitle={`${formatBytes(stats.mem.total)} total`}
          percent={percentOf(stats.mem.used, stats.mem.total)}
          primaryLabel={formatBytes(stats.mem.used)}
          secondaryLabel={`of ${formatBytes(stats.mem.total)}`}
        />
        <UsageCard
          icon={<HiOutlineServerStack className="w-5 h-5" />}
          title="Disk"
          subtitle={stats.disk.mountpoint}
          percent={percentOf(stats.disk.used, stats.disk.total)}
          primaryLabel={formatBytes(stats.disk.used)}
          secondaryLabel={`of ${formatBytes(stats.disk.total)}`}
        />
        <CountCard
          icon={<HiOutlineCube className="w-5 h-5" />}
          title="Containers"
          main={`${stats.docker.running} / ${stats.docker.total}`}
          sub={`${stats.docker.stopped} stopped`}
        />
        <CountCard
          icon={<HiOutlinePhoto className="w-5 h-5" />}
          title="Images"
          main={String(stats.docker.images)}
          sub="local"
        />
        <CountCard
          icon={<HiOutlineClock className="w-5 h-5" />}
          title="Uptime"
          main={formatUptime(stats.uptime)}
          sub={`${stats.os.distro || stats.os.platform} ${stats.os.release}`.trim()}
        />
      </div>
      {!connected && (
        <p className="mt-4 text-xs text-gray-500">Reconnecting to stream…</p>
      )}
    </div>
  );
}

function UsageCard({
  icon,
  title,
  subtitle,
  percent,
  primaryLabel,
  secondaryLabel,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  percent: number;
  primaryLabel: string;
  secondaryLabel: string;
}) {
  const pct = clamp(percent, 0, 100);
  const barColor =
    pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-yellow-500" : "bg-blue-500";
  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-gray-300">
          {icon}
          <span className="font-medium">{title}</span>
        </div>
        <span className="text-xs text-gray-500 truncate max-w-[50%]" title={subtitle}>
          {subtitle}
        </span>
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xl font-semibold text-white">{primaryLabel}</span>
        <span className="text-xs text-gray-500">{secondaryLabel}</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function CountCard({
  icon,
  title,
  main,
  sub,
}: {
  icon: React.ReactNode;
  title: string;
  main: string;
  sub: string;
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-gray-300 mb-3">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <div className="text-2xl font-semibold text-white">{main}</div>
      <div className="text-xs text-gray-500 mt-1 truncate" title={sub}>
        {sub}
      </div>
    </div>
  );
}

function percentOf(used: number, total: number): number {
  if (!total) return 0;
  return (used / total) * 100;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
