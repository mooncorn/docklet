import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { generate } from "selfsigned";
import { setSetting } from "../config";

export async function ensureSelfSignedCert(certsDir: string): Promise<void> {
  const certPath = join(certsDir, "cert.pem");
  const keyPath = join(certsDir, "key.pem");

  if (existsSync(certPath) && existsSync(keyPath)) {
    return;
  }

  const notAfterDate = new Date();
  notAfterDate.setFullYear(notAfterDate.getFullYear() + 10);

  const pems = await generate([{ name: "commonName", value: "docklet" }], {
    keySize: 2048,
    algorithm: "sha256",
    notAfterDate,
    extensions: [
      { name: "basicConstraints", cA: false },
      {
        name: "keyUsage",
        digitalSignature: true,
        keyEncipherment: true,
      },
      {
        name: "extKeyUsage",
        serverAuth: true,
      },
      {
        name: "subjectAltName",
        altNames: [
          { type: 2, value: "localhost" },
          { type: 7, ip: "127.0.0.1" },
          { type: 7, ip: "::1" },
        ],
      },
    ],
  });

  writeFileSync(certPath, pems.cert);
  writeFileSync(keyPath, pems.private, { mode: 0o600 });

  setSetting("tls_cert_type", "self-signed");
  setSetting("tls_enabled", "true");
}
