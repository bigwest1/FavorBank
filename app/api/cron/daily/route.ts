import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { escrowRelease, loanRepay, spend } from "@/lib/credits/ledger";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const now = new Date();
  const results: Record<string, any> = {};

  try {
    // 1) Expire stale requests and slots (daily sweep)
    const [expiredRequests, expiredSlots] = await prisma.$transaction([
      prisma.request.updateMany({ where: { status: 'OPEN', expiresAt: { lt: now } }, data: { status: 'CANCELLED' } }),
      prisma.slot.updateMany({ where: { status: 'OPEN', end: { lt: now } }, data: { status: 'CANCELLED' } })
    ]);
    results.expire = { expiredRequests: expiredRequests.count, expiredSlots: expiredSlots.count };

    // 2) Loan repayments due today (weekly cadence simulated daily)
    const dueLoans = await prisma.loan.findMany({ where: { status: 'ACTIVE', nextPaymentDue: { lte: now } } });
    const repayOut: any[] = [];
    await prisma.$transaction(async (tx) => {
      for (const loan of dueLoans) {
        const membership = await tx.membership.findFirst({ where: { userId: loan.borrowerId, circleId: loan.circleId } });
        if (!membership || membership.balanceCredits < loan.weeklyPayment) {
          repayOut.push({ loanId: loan.id, status: 'skipped_insufficient' });
          continue;
        }
        await loanRepay(tx, loan.circleId, loan.borrowerId, loan.weeklyPayment, loan.id, { schedule: 'daily' });
        const remaining = loan.remaining - loan.weeklyPayment;
        const paymentsRemaining = Math.max(0, (loan.paymentsRemaining || 0) - 1);
        await tx.loan.update({ where: { id: loan.id }, data: {
          remaining,
          paymentsRemaining,
          nextPaymentDue: new Date(now.getTime() + 7*24*60*60*1000),
          status: remaining <= 0 ? 'COMPLETED' : 'ACTIVE',
          completedAt: remaining <= 0 ? now : null,
        }});
        repayOut.push({ loanId: loan.id, status: remaining <= 0 ? 'completed' : 'paid', amount: loan.weeklyPayment });
      }
    });
    results.loanRepay = repayOut;

    // 3) Auto-resolve small disputes past deadline (<= 50 credits)
    const claims = await prisma.insuranceClaim.findMany({
      where: { status: 'PENDING', claimDeadline: { lt: now }, amount: { lte: 50 } },
      include: { booking: { include: { slot: { include: { circle: true } } } } }
    });
    const disputesOut: any[] = [];
    await prisma.$transaction(async (tx) => {
      for (const claim of claims) {
        await tx.insuranceClaim.update({ where: { id: claim.id }, data: { status: 'APPROVED', resolvedAt: now, autoResolved: true } });
        await escrowRelease(tx, claim.booking.slot.circle.id, claim.booking.bookerId, claim.claimantId, claim.amount, claim.bookingId, { kind: 'INSURANCE_CLAIM_REFUND', claimId: claim.id });
        disputesOut.push({ claimId: claim.id, refunded: claim.amount });
      }
    });
    results.disputes = disputesOut;

    // 4) Weekly Pro payout batch (only run on Monday)
    const isMonday = now.getDay() === 1; // 0=Sun,1=Mon
    if (isMonday) {
      const bonuses = await prisma.proBonus.findMany({ where: { payoutId: null }, orderBy: { accrualDate: 'asc' } });
      const byUser = bonuses.reduce<Record<string, typeof bonuses>>((acc, b) => { (acc[b.userId] ||= []).push(b); return acc; }, {} as any);
      const payouts: any[] = [];
      await prisma.$transaction(async (tx) => {
        for (const [userId, list] of Object.entries(byUser)) {
          const totalCents = list.reduce((s, b) => s + b.bonusAmount, 0);
          const payout = await tx.payout.create({ data: { userId, status: 'COMPLETED', totalAmount: totalCents, bonusCount: list.length, weekStartDate: now, weekEndDate: now, stripeAccountId: 'acct_test', processedAt: now } });
          await tx.proBonus.updateMany({ where: { id: { in: list.map(b => b.id) } }, data: { payoutId: payout.id } });
          payouts.push({ userId, payoutId: payout.id, count: list.length });
        }
      });
      results.proPayout = payouts;
    }

    // 5) Monthly demurrage (1st of month)
    const isFirstOfMonth = now.getDate() === 1;
    if (isFirstOfMonth) {
      const threshold = 800;
      const rate = 0.015; // 1.5%
      const memberships = await prisma.membership.findMany({ where: { balanceCredits: { gt: threshold }, isActive: true }, select: { id: true, userId: true, circleId: true, balanceCredits: true } });
      const acts: any[] = [];
      for (const m of memberships) {
        const excess = m.balanceCredits - threshold;
        const decay = Math.floor(excess * rate);
        if (decay > 0) {
          await spend(prisma, m.circleId, m.userId, decay, { kind: 'demurrage', rate, threshold, appliedAt: now.toISOString() });
          acts.push({ membershipId: m.id, amount: decay });
        }
      }
      results.demurrage = { count: acts.length };
    }

    return NextResponse.json({ success: true, ...results });
  } catch (e) {
    console.error('daily cron error', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

