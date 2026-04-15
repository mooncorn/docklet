import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/auth/middleware";
import { listImages } from "@/lib/docker/images";

export async function GET() {
  try {
    await requireAuth();
    const images = await listImages();
    return NextResponse.json(images);
  } catch (error) {
    return handleApiError(error);
  }
}
