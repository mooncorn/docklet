import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "ssh2", "dockerode", "docker-modem"],
};

export default nextConfig;
