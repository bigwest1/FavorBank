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

    // Must be member of circle
    const membership = await prisma.membership.findFirst({ where: { circleId: tool.circleId, userId: session.user.id } });
    if (!membership) return NextResponse.json({ error: "Not a member of this circle" }, { status: 403 });

    if (tool.status !== "AVAILABLE") {
      return NextResponse.json({ error: "Tool not available" }, { status: 400 });
    }

    const fee = tool.feePerBorrow || 1;

    // Create loan, charge user (simple balance decrement) and mark tool borrowed
    const loan = await prisma.$transaction(async (tx) => {
      // Ensure membership and sufficient credits
      const member = await tx.membership.findFirst({ where: { circleId: tool.circleId, userId: session.user!.id } });
      if (!member) throw new Error("NOT_MEMBER");
      if ((member.balanceCredits || 0) < fee) throw new Error("INSUFFICIENT_CREDITS");

      await tx.membership.update({
        where: { userId_circleId: { userId: session.user!.id, circleId: tool.circleId } },
        data: { balanceCredits: { decrement: fee } }
      });

      await tx.ledgerEntry.create({
        data: {
          circleId: tool.circleId,
          bookingId: null,
          loanId: null,
          fromUserId: session.user!.id,
          toUserId: null,
          amount: fee,
          type: "DEBIT",
          meta: { kind: "tool_borrow_fee", toolId: tool.id }
        }
      });

      const loan = await tx.toolLoan.create({
        data: {
          toolId: tool.id,
          circleId: tool.circleId,
          borrowerId: session.user!.id,
          feeCharged: fee,
          status: "ACTIVE",
        },
      });
      await tx.tool.update({ where: { id: tool.id }, data: { status: "BORROWED" } });
      return loan;
    });

    return NextResponse.json({ success: true, loan });
  } catch (e) {
    console.error("Tool checkout error:", e);
    const msg = (e as any)?.message || '';
    if (msg === 'NOT_MEMBER') return NextResponse.json({ error: "Not a member of this circle" }, { status: 403 });
    if (msg === 'INSUFFICIENT_CREDITS') return NextResponse.json({ error: "Insufficient credits" }, { status: 400 });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
