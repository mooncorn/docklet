import { NextResponse } from "next/server";
import { requireRole, handleApiError } from "@/lib/auth/middleware";

export async function POST() {
  try {
    await requireRole("admin");

    // Give the response time to flush before the process exits.
    // Docker's restart policy will bring the container back up.
    setTimeout(() => process.exit(0), 500);

    return NextResponse.json({ success: true, message: "Restarting..." });
  } catch (error) {
    return handleApiError(error);
  }
}
