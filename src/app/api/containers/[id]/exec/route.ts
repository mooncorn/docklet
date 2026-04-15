import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireRole, handleApiError } from "@/lib/auth/middleware";
import { execInContainer } from "@/lib/docker/containers";

const execSchema = z.object({
  cmd: z.array(z.string().min(1)).min(1),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole("admin");
    const { id } = await params;
    const body = await request.json();
    const { cmd } = execSchema.parse(body);
    const result = await execInContainer(id, cmd);
    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error);
  }
}
