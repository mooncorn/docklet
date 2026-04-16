import { describe, it, expect, vi, beforeEach } from "vitest";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

vi.mock("@/lib/config", () => ({
  setSetting: vi.fn(),
}));

describe("ensureSelfSignedCert", () => {
  let certsDir: string;

  beforeEach(() => {
    certsDir = join(tmpdir(), `docklet-certs-test-${Date.now()}`);
    mkdirSync(certsDir, { recursive: true });
    vi.clearAllMocks();
  });

  it("generates cert and key when neither exists", async () => {
    const { existsSync } = await import("fs");
    const { setSetting } = await import("@/lib/config");
    const { ensureSelfSignedCert } = await import("./generate");

    await ensureSelfSignedCert(certsDir);

    expect(existsSync(join(certsDir, "cert.pem"))).toBe(true);
    expect(existsSync(join(certsDir, "key.pem"))).toBe(true);
    expect(setSetting).toHaveBeenCalledWith("tls_cert_type", "self-signed");
    expect(setSetting).toHaveBeenCalledWith("tls_enabled", "true");

    rmSync(certsDir, { recursive: true });
  });

  it("is a no-op when both cert and key already exist", async () => {
    const { writeFileSync, readFileSync } = await import("fs");
    const { setSetting } = await import("@/lib/config");
    const { ensureSelfSignedCert } = await import("./generate");

    const certPath = join(certsDir, "cert.pem");
    const keyPath = join(certsDir, "key.pem");
    writeFileSync(certPath, "existing-cert");
    writeFileSync(keyPath, "existing-key");

    await ensureSelfSignedCert(certsDir);

    expect(readFileSync(certPath, "utf8")).toBe("existing-cert");
    expect(readFileSync(keyPath, "utf8")).toBe("existing-key");
    expect(setSetting).not.toHaveBeenCalled();

    rmSync(certsDir, { recursive: true });
  });

  it("generates cert when only key is missing", async () => {
    const { writeFileSync, existsSync } = await import("fs");
    const { ensureSelfSignedCert } = await import("./generate");

    writeFileSync(join(certsDir, "cert.pem"), "existing-cert");

    await ensureSelfSignedCert(certsDir);

    expect(existsSync(join(certsDir, "key.pem"))).toBe(true);

    rmSync(certsDir, { recursive: true });
  });
});
