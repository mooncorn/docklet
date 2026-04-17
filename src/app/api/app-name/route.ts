import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/auth/middleware";
import { getSetting } from "@/lib/config";

export async function GET() {
  try {
    await requireAuth();
    const appName = getSetting("app_name") ?? "Docklet";
    return NextResponse.json({ app_name: appName });
  } catch (error) {
    return handleApiError(error);
  }
}
