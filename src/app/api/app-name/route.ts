import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/auth/middleware";
import { getSetting } from "@/lib/config";

export async function GET() {
  try {
    const appName = getSetting("app_name") ?? "Docklet";
    return NextResponse.json({ app_name: appName });
  } catch (error) {
    return handleApiError(error);
  }
}
