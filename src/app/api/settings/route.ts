import { NextRequest, NextResponse } from "next/server";
import { requireRole, handleApiError } from "@/lib/auth/middleware";
import { getAllSettings, setSetting } from "@/lib/config";
import { writeFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";
import { getDataDir } from "@/lib/db";
import { ensureSelfSignedCert } from "@/lib/certs/generate";

// Hidden settings that should never be exposed to the client
const HIDDEN_KEYS = ["jwt_secret"];

export async function GET() {
  try {
    await requireRole("admin");
    const all = getAllSettings();
    for (const key of HIDDEN_KEYS) {
      delete all[key];
    }
    return NextResponse.json(all);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole("admin");
    const body = await request.json();

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    for (const [key, value] of Object.entries(body)) {
      if (HIDDEN_KEYS.includes(key)) continue;
      if (typeof value !== "string") continue;
      setSetting(key, value);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// TLS certificate upload
export async function POST(request: NextRequest) {
  try {
    await requireRole("admin");
    const formData = await request.formData();
    const cert = formData.get("cert") as File | null;
    const key = formData.get("key") as File | null;

    if (!cert || !key) {
      return NextResponse.json(
        { error: "Both cert and key files are required" },
        { status: 400 }
      );
    }

    const certsDir = join(getDataDir(), "certs");
    const certContent = Buffer.from(await cert.arrayBuffer());
    const keyContent = Buffer.from(await key.arrayBuffer());

    writeFileSync(join(certsDir, "cert.pem"), certContent);
    writeFileSync(join(certsDir, "key.pem"), keyContent, { mode: 0o600 });

    setSetting("tls_enabled", "true");
    setSetting("tls_cert_type", "custom");

    return NextResponse.json({
      success: true,
      message: "TLS certificates uploaded. Restart Docklet to apply.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// Revert to self-signed certificate
export async function DELETE() {
  try {
    await requireRole("admin");
    const certsDir = join(getDataDir(), "certs");

    for (const file of ["cert.pem", "key.pem"]) {
      const filePath = join(certsDir, file);
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }

    await ensureSelfSignedCert(certsDir);

    return NextResponse.json({
      success: true,
      message: "Self-signed certificate regenerated. Restart Docklet to apply.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
