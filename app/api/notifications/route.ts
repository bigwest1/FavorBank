import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const unread = searchParams.get("unread") === "true";
  const limit = parseInt(searchParams.get("limit") || "20", 10);

  try {
    const notifications = await prisma.notification.findMany({
      where: {
        userId: session.user.id,
        ...(unread ? { read: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    return NextResponse.json({ notifications });
  } catch (e) {
    console.error("GET notifications error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const MarkReadSchema = z.object({ ids: z.array(z.string()).min(1) });

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json();
    const data = MarkReadSchema.parse(body);
    await prisma.notification.updateMany({
      where: { id: { in: data.ids }, userId: session.user.id },
      data: { read: true },
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Invalid input", details: e.errors }, { status: 400 });
    console.error("PUT notifications error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

