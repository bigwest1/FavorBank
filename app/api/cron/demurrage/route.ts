import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { spend } from "@/lib/credits/ledger";

// Apply monthly demurrage on balances > threshold
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { searchParams } = new URL(req.url);
    const threshold = parseInt(searchParams.get('threshold') || '800', 10);
    const rateParam = searchParams.get('rate');
    const rate = rateParam ? parseFloat(rateParam) : 0.015; // 1.5%
    const now = new Date();

    // Find memberships above threshold
    const memberships = await prisma.membership.findMany({
      where: { balanceCredits: { gt: threshold }, isActive: true },
      select: { id: true, userId: true, circleId: true, balanceCredits: true }
    });

    const actions: Array<{ membershipId: string; amount: number } & any> = [];
    for (const m of memberships) {
      const excess = m.balanceCredits - threshold;
      const decay = Math.floor(excess * rate);
      if (decay > 0) {
        // Charge demurrage to treasury
        await spend(prisma, m.circleId, m.userId, decay, { kind: 'demurrage', rate, threshold, appliedAt: now.toISOString() });
        actions.push({ membershipId: m.id, userId: m.userId, circleId: m.circleId, amount: decay });
      }
    }

    return NextResponse.json({ success: true, count: actions.length, totalDecayed: actions.reduce((s,a)=>s+a.amount,0), rate, threshold, actions });
  } catch (e) {
    console.error('Cron demurrage error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

