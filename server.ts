import { createServer as createHttpServer } from "http";
import { createServer as createHttpsServer } from "https";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const dataDir = process.env.DOCKLET_DATA_DIR || "/docklet-data";

async function main() {
  // Initialize data directories and run migrations
  const { initDataDirs, runMigrations } = await import("./src/lib/db/index");
  initDataDirs();
  runMigrations();

  // Ensure JWT secret exists
  const { ensureJwtSecret } = await import("./src/lib/config/index");
  ensureJwtSecret();

  // Ensure TLS certificates exist (auto-generate self-signed if missing)
  const certsDir = join(dataDir, "certs");
  const { ensureSelfSignedCert } = await import("./src/lib/certs/generate");
  await ensureSelfSignedCert(certsDir);

  // Check for TLS certificates
  const certPath = join(certsDir, "cert.pem");
  const keyPath = join(certsDir, "key.pem");
  const tlsEnabled = existsSync(certPath) && existsSync(keyPath);

  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  let server;

  if (tlsEnabled) {
    const cert = readFileSync(certPath);
    const key = readFileSync(keyPath);
    server = createHttpsServer({ cert, key }, (req, res) => {
      handle(req, res);
    });
    console.log(`Docklet starting with HTTPS on port ${port}`);
  } else {
    server = createHttpServer((req, res) => {
      handle(req, res);
    });
    console.log(`Docklet starting with HTTP on port ${port}`);
  }

  server.listen(port, hostname, () => {
    console.log(`Docklet ready at ${tlsEnabled ? "https" : "http"}://${hostname}:${port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start Docklet:", err);
  process.exit(1);
});
