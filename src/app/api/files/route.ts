import { NextRequest, NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAuth, requireRole, handleApiError } from "@/lib/auth/middleware";
import {
  listDir,
  readTextFile,
  writeTextFile,
  statPath,
  rename,
  remove,
  MAX_TEXT_FILE_BYTES,
} from "@/lib/files/service";

export const runtime = "nodejs";

const writeSchema = z.object({
  path: z.string(),
  content: z.string().max(MAX_TEXT_FILE_BYTES),
});

const renameSchema = z.object({
  path: z.string(),
  newPath: z.string(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const relPath = request.nextUrl.searchParams.get("path") ?? "";
    const entry = await statPath(relPath);
    if (entry.isDir) {
      const entries = await listDir(relPath);
      return NextResponse.json({ entry, entries });
    }
    const { content, encoding } = await readTextFile(relPath);
    return NextResponse.json({ entry, content, encoding });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireRole("admin", "mod");
    const body = await request.json();
    const parsed = writeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const entry = await writeTextFile(parsed.data.path, parsed.data.content);
    return NextResponse.json({ entry });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireRole("admin", "mod");
    const body = await request.json();
    const parsed = renameSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    }
    const entry = await rename(parsed.data.path, parsed.data.newPath);
    return NextResponse.json({ entry });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireRole("admin", "mod");
    const relPath = request.nextUrl.searchParams.get("path") ?? "";
    await remove(relPath);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
