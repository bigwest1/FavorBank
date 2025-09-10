import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateToolSchema = z.object({
  name: z.string().min(2).max(100),
  description: z.string().max(1000).optional(),
  feePerBorrow: z.number().min(0).max(50).default(1),
  photoBase64: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Must be circle member
    const membership = await prisma.membership.findFirst({ where: { circleId: params.id, userId: session.user.id } });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

    const tools = await prisma.tool.findMany({
      where: { circleId: params.id },
      include: {
        loans: {
          where: { status: "ACTIVE" },
          include: { borrower: { select: { id: true, name: true } } },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tools });
  } catch (e) {
    console.error("GET tools error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await request.json();
    const data = CreateToolSchema.parse(body);

    // Must be circle member
    const membership = await prisma.membership.findFirst({ where: { circleId: params.id, userId: session.user.id } });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

    const tool = await prisma.tool.create({
      data: {
        circleId: params.id,
        name: data.name,
        description: data.description,
        feePerBorrow: data.feePerBorrow,
        photoBase64: data.photoBase64,
        qrToken: undefined,
      },
    });

    return NextResponse.json({ success: true, tool });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: e.errors }, { status: 400 });
    }
    console.error("POST tools error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

