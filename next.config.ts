import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3", "dockerode", "docker-modem", "ssh2", "file-type"],
};

export default nextConfig;
