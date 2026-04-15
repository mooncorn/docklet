import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/auth/middleware";
import { getSystemStats } from "@/lib/system/stats";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuth();
    const stats = await getSystemStats();
    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error);
  }
}
