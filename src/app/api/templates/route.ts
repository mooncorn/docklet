import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAuth, handleApiError } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db";
import { containerTemplates } from "@/lib/db/schema";

const createTemplateSchema = z.object({
  name: z.string().min(1),
  config: z.object({}).passthrough(),
});

export async function GET() {
  try {
    await requireAuth();
    const db = getDb();
    const templates = db.select().from(containerTemplates).all();
    return NextResponse.json(templates);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const { name, config } = createTemplateSchema.parse(body);
    const db = getDb();
    const template = db
      .insert(containerTemplates)
      .values({
        name,
        config: JSON.stringify(config),
        createdBy: session.userId,
      })
      .returning()
      .get();
    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
