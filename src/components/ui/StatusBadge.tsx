const statusConfig: Record<string, { className: string; label: string }> = {
  running: { className: "badge-green", label: "Running" },
  exited: { className: "badge-red", label: "Exited" },
  stopped: { className: "badge-red", label: "Stopped" },
  dead: { className: "badge-red", label: "Dead" },
  paused: { className: "badge-yellow", label: "Paused" },
  restarting: { className: "badge-blue", label: "Restarting" },
  created: { className: "badge-gray", label: "Created" },
};

interface StatusBadgeProps {
  status: string;
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    className: "badge-gray",
    label: status,
  };
  return <span className={`badge ${config.className}`}>{config.label}</span>;
}
