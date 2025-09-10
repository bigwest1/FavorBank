import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loanRepay } from "@/lib/credits/ledger";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const now = new Date();
    const dueLoans = await prisma.loan.findMany({
      where: { status: 'ACTIVE', nextPaymentDue: { lte: now } },
      orderBy: { nextPaymentDue: 'asc' }
    });

    const results: any[] = [];
    await prisma.$transaction(async (tx) => {
      for (const loan of dueLoans) {
        const membership = await tx.membership.findFirst({ where: { userId: loan.borrowerId, circleId: loan.circleId } });
        if (!membership || membership.balanceCredits < loan.weeklyPayment) {
          results.push({ loanId: loan.id, status: 'skipped', reason: 'insufficient_balance' });
          continue;
        }
        // Apply repayment
        await loanRepay(tx, loan.circleId, loan.borrowerId, loan.weeklyPayment, loan.id, { schedule: 'weekly' });
        const remaining = loan.remaining - loan.weeklyPayment;
        const paymentsRemaining = Math.max(0, (loan.paymentsRemaining || 0) - 1);
        await tx.loan.update({
          where: { id: loan.id },
          data: {
            remaining: remaining,
            paymentsRemaining,
            nextPaymentDue: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            status: remaining <= 0 ? 'COMPLETED' : 'ACTIVE',
            completedAt: remaining <= 0 ? now : null
          }
        });
        results.push({ loanId: loan.id, status: remaining <= 0 ? 'completed' : 'paid', amount: loan.weeklyPayment });
      }
    });

    return NextResponse.json({ success: true, processed: results });
  } catch (e) {
    console.error('Cron loan-repay error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

