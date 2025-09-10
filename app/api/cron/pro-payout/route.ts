import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Simulate weekly Pro bonus payout batch: groups unpaid ProBonus by user into a Payout
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    // Find all bonuses without payoutId
    const bonuses = await prisma.proBonus.findMany({
      where: { payoutId: null },
      orderBy: { accrualDate: 'asc' }
    });

    const byUser = bonuses.reduce<Record<string, typeof bonuses>>((acc, b) => {
      (acc[b.userId] ||= []).push(b); return acc;
    }, {} as any);

    const results: any[] = [];
    await prisma.$transaction(async (tx) => {
      for (const [userId, list] of Object.entries(byUser)) {
        const totalCents = list.reduce((s, b) => s + b.bonusAmount, 0);
        const payout = await tx.payout.create({
          data: {
            userId,
            status: 'COMPLETED',
            totalAmount: totalCents,
            bonusCount: list.length,
            weekStartDate: new Date(),
            weekEndDate: new Date(),
            stripeAccountId: 'acct_test',
            processedAt: new Date()
          }
        });
        await tx.proBonus.updateMany({ where: { id: { in: list.map(b => b.id) } }, data: { payoutId: payout.id } });
        results.push({ userId, payoutId: payout.id, count: list.length, totalCents });
      }
    });

    return NextResponse.json({ success: true, batches: results });
  } catch (e) {
    console.error('Cron pro-payout error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

