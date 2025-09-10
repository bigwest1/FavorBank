import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const AddItemSchema = z.object({
  description: z.string().min(2).max(200),
  quantity: z.number().min(1).max(10).default(1),
  tipCredits: z.number().min(1).max(2).default(1)
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const bundle = await prisma.errandBundle.findUnique({ where: { id: params.id } });
    if (!bundle) return NextResponse.json({ error: "Bundle not found" }, { status: 404 });

    // Must be circle member
    const membership = await prisma.membership.findFirst({ where: { circleId: bundle.circleId, userId: session.user.id } });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

    if (bundle.status !== "OPEN") return NextResponse.json({ error: "Bundle is closed" }, { status: 400 });

    const body = await request.json();
    const data = AddItemSchema.parse(body);

    const item = await prisma.errandItem.create({
      data: {
        bundleId: params.id,
        requesterId: session.user.id,
        description: data.description,
        quantity: data.quantity,
        tipCredits: data.tipCredits,
        status: "PENDING",
      }
    });

    return NextResponse.json({ success: true, item });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: e.errors }, { status: 400 });
    }
    console.error("Add errand item error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

