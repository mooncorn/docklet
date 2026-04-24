"use client";

import {
  HiOutlineCpuChip,
  HiOutlineCircleStack,
  HiOutlineCube,
  HiOutlineArrowDownTray,
  HiOutlineArrowUpTray,
  HiOutlineServerStack,
} from "react-icons/hi2";
import Link from "next/link";
import { useDockerOverview } from "@/hooks/useDockerOverview";
import StatusBadge from "@/components/ui/StatusBadge";
import type { ContainerStats } from "@/lib/docker/stats";

export default function DashboardStats() {
  const { overview, connected } = useDockerOverview();

  if (!overview) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="spinner" />
      </div>
    );
  }

  const memPercent = percentOf(
    overview.totals.memory.used,
    overview.totals.memory.limit
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <CountCard
          icon={<HiOutlineCube className="w-5 h-5" />}
          title="Containers"
          main={`${overview.counts.running} / ${overview.counts.total}`}
          sub={`${overview.counts.stopped} stopped`}
        />
        <UsageCard
          icon={<HiOutlineCpuChip className="w-5 h-5" />}
          title="CPU"
          percent={overview.totals.cpuPercent}
          primaryLabel={`${overview.totals.cpuPercent.toFixed(1)}%`}
          secondaryLabel="aggregate"
        />
        <UsageCard
          icon={<HiOutlineCircleStack className="w-5 h-5" />}
          title="Memory"
          percent={memPercent}
          primaryLabel={formatBytes(overview.totals.memory.used)}
          secondaryLabel={`of ${formatBytes(overview.totals.memory.limit)}`}
        />
        <IoCard
          icon={<HiOutlineServerStack className="w-5 h-5" />}
          title="Network / Block I/O"
          net={overview.totals.network}
          block={overview.totals.block}
        />
      </div>

      <ContainerTable containers={overview.containers} />

      {!connected && (
        <p className="text-xs text-gray-500">Reconnecting to stream…</p>
      )}
    </div>
  );
}

function UsageCard({
  icon,
  title,
  percent,
  primaryLabel,
  secondaryLabel,
}: {
  icon: React.ReactNode;
  title: string;
  percent: number;
  primaryLabel: string;
  secondaryLabel: string;
}) {
  const pct = clamp(percent, 0, 100);
  const barColor =
    pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-yellow-500" : "bg-blue-500";
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-gray-300 mb-3">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-2xl font-semibold text-white">
          {primaryLabel}
        </span>
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

function IoCard({
  icon,
  title,
  net,
  block,
}: {
  icon: React.ReactNode;
  title: string;
  net: { rx: number; tx: number };
  block: { read: number; write: number };
}) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 text-gray-300 mb-3">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-y-1 text-sm">
        <span className="flex items-center gap-1 text-gray-400">
          <HiOutlineArrowDownTray className="w-4 h-4" /> net rx
        </span>
        <span className="text-right text-white">{formatBytes(net.rx)}</span>
        <span className="flex items-center gap-1 text-gray-400">
          <HiOutlineArrowUpTray className="w-4 h-4" /> net tx
        </span>
        <span className="text-right text-white">{formatBytes(net.tx)}</span>
        <span className="flex items-center gap-1 text-gray-400">
          <HiOutlineArrowDownTray className="w-4 h-4" /> blk read
        </span>
        <span className="text-right text-white">{formatBytes(block.read)}</span>
        <span className="flex items-center gap-1 text-gray-400">
          <HiOutlineArrowUpTray className="w-4 h-4" /> blk write
        </span>
        <span className="text-right text-white">
          {formatBytes(block.write)}
        </span>
      </div>
    </div>
  );
}

function ContainerTable({ containers }: { containers: ContainerStats[] }) {
  if (containers.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-gray-400 text-sm">No running containers</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm" data-testid="dashboard-container-table">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="text-left py-2 pr-4">Name</th>
            <th className="text-left py-2 pr-4">State</th>
            <th className="text-right py-2 pr-4">CPU</th>
            <th className="text-right py-2 pr-4">Memory</th>
            <th className="text-right py-2 pr-4">Net rx/tx</th>
            <th className="text-right py-2">Block r/w</th>
          </tr>
        </thead>
        <tbody>
          {containers.map((c) => (
            <tr key={c.id} className="border-b border-gray-700/50">
              <td className="py-2 pr-4">
                <Link
                  href={`/containers/${c.id}`}
                  className="text-blue-300 hover:underline"
                >
                  {c.name}
                </Link>
              </td>
              <td className="py-2 pr-4">
                <StatusBadge status={c.state} />
              </td>
              <td className="py-2 pr-4 text-right">
                {c.cpuPercent.toFixed(1)}%
              </td>
              <td className="py-2 pr-4 text-right">
                {formatBytes(c.memory.used)} / {formatBytes(c.memory.limit)}
              </td>
              <td className="py-2 pr-4 text-right">
                {formatBytes(c.network.rx)} / {formatBytes(c.network.tx)}
              </td>
              <td className="py-2 text-right">
                {formatBytes(c.block.read)} / {formatBytes(c.block.write)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
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
