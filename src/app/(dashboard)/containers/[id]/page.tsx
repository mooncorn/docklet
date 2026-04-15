"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  HiOutlinePlay,
  HiOutlineStop,
  HiOutlineArrowPath,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineCommandLine,
} from "react-icons/hi2";
import PageHeader from "@/components/ui/PageHeader";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import Tabs from "@/components/ui/Tabs";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useContainerLogs } from "@/hooks/useContainerLogs";
import { useDockerEvents } from "@/hooks/useDockerEvents";
import type { ContainerDetail } from "@/lib/docker/types";
import { useAuth } from "@/hooks/useAuth";

const tabs = [
  { id: "logs", label: "Logs" },
  { id: "info", label: "Info" },
  { id: "ports", label: "Ports" },
  { id: "mounts", label: "Mounts" },
  { id: "env", label: "Environment" },
];

export default function ContainerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [container, setContainer] = useState<ContainerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("logs");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const fetchContainer = useCallback(async () => {
    try {
      const res = await fetch(`/api/containers/${id}`);
      if (res.ok) {
        setContainer(await res.json());
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchContainer();
  }, [fetchContainer]);

  useDockerEvents(
    useCallback(
      (event) => {
        if (event.id?.startsWith(id)) {
          fetchContainer();
        }
      },
      [id, fetchContainer]
    )
  );

  const handleAction = useCallback(
    async (action: string) => {
      setActionLoading(action);
      try {
        await fetch(`/api/containers/${id}/${action}`, { method: "POST" });
        await fetchContainer();
      } catch {
        // Silently fail
      } finally {
        setActionLoading(null);
      }
    },
    [id, fetchContainer]
  );

  const handleDelete = useCallback(async () => {
    setActionLoading("delete");
    try {
      await fetch(`/api/containers/${id}?force=true`, { method: "DELETE" });
      router.push("/containers");
    } catch {
      setActionLoading(null);
    }
  }, [id, router]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    );
  }

  if (!container) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-400">Container not found</p>
      </div>
    );
  }

  const isRunning = container.state === "running";

  return (
    <div className="space-y-6">
      <PageHeader
        title={container.name}
        actions={
          <>
            <StatusBadge status={container.state} />
            {isRunning ? (
              <Button
                variant="secondary"
                icon={<HiOutlineStop className="w-4 h-4" />}
                onClick={() => handleAction("stop")}
                loading={actionLoading === "stop"}
              >
                Stop
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={<HiOutlinePlay className="w-4 h-4" />}
                onClick={() => handleAction("start")}
                loading={actionLoading === "start"}
              >
                Start
              </Button>
            )}
            <Button
              variant="icon"
              icon={<HiOutlineArrowPath className="w-5 h-5" />}
              onClick={() => handleAction("restart")}
              loading={actionLoading === "restart"}
              disabled={!isRunning}
            />
            <Link href={`/containers/${id}/edit`}>
              <Button variant="icon" icon={<HiOutlinePencilSquare className="w-5 h-5" />} />
            </Link>
            <Button
              variant="icon"
              icon={<HiOutlineTrash className="w-5 h-5 text-red-400" />}
              onClick={() => setDeleteOpen(true)}
            />
          </>
        }
      />

      <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      <div>
        {activeTab === "logs" && (
          <LogsTab containerId={id} isRunning={isRunning} isAdmin={user?.role === "admin"} />
        )}
        {activeTab === "info" && <InfoTab container={container} />}
        {activeTab === "ports" && <PortsTab container={container} />}
        {activeTab === "mounts" && <MountsTab container={container} />}
        {activeTab === "env" && <EnvTab container={container} />}
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Container"
        message={`Are you sure you want to delete "${container.name}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={actionLoading === "delete"}
      />
    </div>
  );
}

function LogsTab({
  containerId,
  isRunning,
  isAdmin,
}: {
  containerId: string;
  isRunning: boolean;
  isAdmin: boolean;
}) {
  const { logs, connected, clear } = useContainerLogs(
    isRunning ? containerId : null
  );
  const logEndRef = useRef<HTMLDivElement>(null);
  const [cmd, setCmd] = useState("");
  const [execOutput, setExecOutput] = useState<string | null>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleExec = async () => {
    if (!cmd.trim()) return;
    try {
      const res = await fetch(`/api/containers/${containerId}/exec`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd: ["sh", "-c", cmd] }),
      });
      const data = await res.json();
      setExecOutput(data.output ?? data.error);
      setCmd("");
    } catch {
      setExecOutput("Failed to execute command");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${connected ? "bg-green-400" : "bg-gray-500"}`}
          />
          <span className="text-sm text-gray-400">
            {connected ? "Connected" : "Disconnected"}
          </span>
        </div>
        <Button variant="secondary" onClick={clear}>
          Clear
        </Button>
      </div>
      <div className="log-viewer nice-scrollbar">
        {logs.length === 0 ? (
          <span className="text-gray-500">
            {isRunning ? "Waiting for logs..." : "Container is not running"}
          </span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        )}
        <div ref={logEndRef} />
      </div>

      {isAdmin && isRunning && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              className="input-field flex-1"
              placeholder="Enter command..."
              value={cmd}
              onChange={(e) => setCmd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleExec()}
            />
            <Button
              variant="secondary"
              icon={<HiOutlineCommandLine className="w-4 h-4" />}
              onClick={handleExec}
            >
              Run
            </Button>
          </div>
          {execOutput && (
            <pre className="log-viewer text-xs">{execOutput}</pre>
          )}
        </div>
      )}
    </div>
  );
}

function InfoTab({ container }: { container: ContainerDetail }) {
  const rows = [
    { label: "Container ID", value: container.id.slice(0, 12) },
    { label: "Image", value: container.image },
    {
      label: "Created",
      value: new Date(container.created * 1000).toLocaleString(),
    },
    { label: "Command", value: container.cmd.join(" ") || "—" },
    { label: "Hostname", value: container.hostname || "—" },
    {
      label: "Restart Policy",
      value: container.restartPolicy.name || "no",
    },
    { label: "Network Mode", value: container.networkMode },
    {
      label: "Entrypoint",
      value: container.entrypoint.join(" ") || "—",
    },
  ];

  return (
    <div className="card space-y-3">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex flex-col sm:flex-row sm:gap-4">
          <span className="text-sm text-gray-400 sm:w-40 shrink-0">{label}</span>
          <span className="text-sm break-all">{value}</span>
        </div>
      ))}
      {Object.keys(container.labels).length > 0 && (
        <div>
          <span className="text-sm text-gray-400">Labels</span>
          <div className="mt-1 space-y-1">
            {Object.entries(container.labels).map(([k, v]) => (
              <div key={k} className="text-sm">
                <span className="text-gray-300">{k}</span>
                <span className="text-gray-500"> = </span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PortsTab({ container }: { container: ContainerDetail }) {
  if (container.ports.length === 0) {
    return (
      <div className="card">
        <p className="text-gray-400 text-sm">No port mappings</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="text-left py-2 pr-4">Host</th>
            <th className="text-left py-2 pr-4">Container</th>
            <th className="text-left py-2">Protocol</th>
          </tr>
        </thead>
        <tbody>
          {container.ports.map((port, i) => (
            <tr key={i} className="border-b border-gray-700/50">
              <td className="py-2 pr-4">
                {port.hostIp ?? "0.0.0.0"}:{port.hostPort ?? "—"}
              </td>
              <td className="py-2 pr-4">{port.containerPort}</td>
              <td className="py-2">{port.protocol}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MountsTab({ container }: { container: ContainerDetail }) {
  if (container.mounts.length === 0) {
    return (
      <div className="card">
        <p className="text-gray-400 text-sm">No volume mounts</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-400 border-b border-gray-700">
            <th className="text-left py-2 pr-4">Source</th>
            <th className="text-left py-2 pr-4">Destination</th>
            <th className="text-left py-2">Mode</th>
          </tr>
        </thead>
        <tbody>
          {container.mounts.map((mount, i) => (
            <tr key={i} className="border-b border-gray-700/50">
              <td className="py-2 pr-4 break-all">{mount.source || "—"}</td>
              <td className="py-2 pr-4 break-all">{mount.destination}</td>
              <td className="py-2">{mount.rw ? "rw" : "ro"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EnvTab({ container }: { container: ContainerDetail }) {
  const [showValues, setShowValues] = useState(false);

  if (container.env.length === 0) {
    return (
      <div className="card">
        <p className="text-gray-400 text-sm">No environment variables</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex justify-end mb-3">
        <Button variant="secondary" onClick={() => setShowValues(!showValues)}>
          {showValues ? "Hide Values" : "Show Values"}
        </Button>
      </div>
      <div className="space-y-1">
        {container.env.map((envVar, i) => {
          const eqIdx = envVar.indexOf("=");
          const key = eqIdx >= 0 ? envVar.slice(0, eqIdx) : envVar;
          const value = eqIdx >= 0 ? envVar.slice(eqIdx + 1) : "";
          return (
            <div key={i} className="text-sm font-mono">
              <span className="text-gray-300">{key}</span>
              <span className="text-gray-500">=</span>
              <span className="break-all">
                {showValues ? value : "••••••••"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
