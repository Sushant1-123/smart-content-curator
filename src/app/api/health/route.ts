import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Simple liveness/readiness check for uptime monitors / deploy platforms. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ok",
      db: "connected",
      gemini: {
        configured: Boolean(process.env.GEMINI_API_KEY),
        model: process.env.GEMINI_MODEL?.trim() || null,
        fallbackModel: process.env.GEMINI_FALLBACK_MODEL?.trim() || null,
      },
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        db: "unreachable",
        gemini: { configured: Boolean(process.env.GEMINI_API_KEY) },
      },
      { status: 503 },
    );
  }
}
