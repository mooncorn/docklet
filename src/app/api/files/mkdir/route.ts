import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireRole, handleApiError } from "@/lib/auth/middleware";
import { mkdir } from "@/lib/files/service";

export const runtime = "nodejs";

const schema = z.object({ path: z.string().min(1) });

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "mod");
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const entry = await mkdir(parsed.data.path);
    return NextResponse.json({ entry });
  } catch (error) {
    return handleApiError(error);
  }
}
