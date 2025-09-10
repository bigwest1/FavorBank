import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tool = await prisma.tool.findUnique({ where: { id: params.id } });
    if (!tool) return NextResponse.json({ error: "Tool not found" }, { status: 404 });

    // Find active loan for this tool by this user
    const loan = await prisma.toolLoan.findFirst({
      where: { toolId: tool.id, status: "ACTIVE", borrowerId: session.user.id },
    });

    if (!loan) {
      return NextResponse.json({ error: "No active loan found for this user" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedLoan = await tx.toolLoan.update({
        where: { id: loan.id },
        data: { status: "RETURNED", returnedAt: new Date() },
      });
      await tx.tool.update({ where: { id: tool.id }, data: { status: "AVAILABLE" } });
      return updatedLoan;
    });

    return NextResponse.json({ success: true, loan: updated });
  } catch (e) {
    console.error("Tool checkin error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

