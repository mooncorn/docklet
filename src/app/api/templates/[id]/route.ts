import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { eq } from "drizzle-orm";
import { requireAuth, handleApiError } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db";
import { containerTemplates } from "@/lib/db/schema";

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.object({}).passthrough().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const db = getDb();
    const template = db
      .select()
      .from(containerTemplates)
      .where(eq(containerTemplates.id, parseInt(id, 10)))
      .get();
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const input = updateTemplateSchema.parse(body);
    const db = getDb();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name) updates.name = input.name;
    if (input.config) updates.config = JSON.stringify(input.config);

    const template = db
      .update(containerTemplates)
      .set(updates)
      .where(eq(containerTemplates.id, parseInt(id, 10)))
      .returning()
      .get();
    if (!template) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const db = getDb();
    db.delete(containerTemplates)
      .where(eq(containerTemplates.id, parseInt(id, 10)))
      .run();
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
