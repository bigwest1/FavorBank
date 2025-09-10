import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateBundleSchema = z.object({
  title: z.string().min(3).max(100),
  departAt: z.string().datetime(),
  location: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const membership = await prisma.membership.findFirst({ where: { circleId: params.id, userId: session.user.id } });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

    const bundles = await prisma.errandBundle.findMany({
      where: { circleId: params.id, status: "OPEN" },
      include: {
        creator: { select: { id: true, name: true } },
        items: {
          include: { requester: { select: { id: true, name: true } } },
          orderBy: { createdAt: "asc" }
        },
      },
      orderBy: { departAt: "asc" }
    });

    return NextResponse.json({ bundles });
  } catch (e) {
    console.error("GET errands error:", e);
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
    const membership = await prisma.membership.findFirst({ where: { circleId: params.id, userId: session.user.id } });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

    const body = await request.json();
    const data = CreateBundleSchema.parse(body);

    const bundle = await prisma.errandBundle.create({
      data: {
        circleId: params.id,
        creatorId: session.user.id,
        title: data.title,
        departAt: new Date(data.departAt),
        location: data.location,
        notes: data.notes,
        status: "OPEN",
      }
    });

    return NextResponse.json({ success: true, bundle });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: e.errors }, { status: 400 });
    }
    console.error("POST errands error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

