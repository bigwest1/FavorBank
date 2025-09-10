import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { escrowRelease } from "@/lib/credits/ledger";

// Auto-resolve small pending claims after deadline; writes ledger entries
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const now = new Date();
    // Pick small claims (<= 50) past deadline and pending
    const claims = await prisma.insuranceClaim.findMany({
      where: { status: 'PENDING', claimDeadline: { lt: now }, amount: { lte: 50 } },
      include: {
        booking: { include: { slot: { include: { circle: true } } } },
        pool: true
      },
      orderBy: { claimDeadline: 'asc' }
    });

    const processed: any[] = [];
    await prisma.$transaction(async (tx) => {
      for (const claim of claims) {
        // Resolve
        await tx.insuranceClaim.update({
          where: { id: claim.id },
          data: { status: 'APPROVED', resolvedAt: now, autoResolved: true }
        });

        // Release original escrow to claimant (booker)
        await escrowRelease(
          tx,
          claim.booking.slot.circle.id,
          claim.booking.bookerId,
          claim.claimantId,
          claim.amount,
          claim.bookingId,
          { kind: 'INSURANCE_CLAIM_REFUND', claimId: claim.id, claimType: claim.claimType }
        );

        // Pay bonus if configured
        if (claim.bonusAmount > 0) {
          await tx.ledgerEntry.create({
            data: {
              circleId: claim.booking.slot.circle.id,
              bookingId: claim.bookingId,
              fromUserId: null,
              toUserId: claim.claimantId,
              amount: claim.bonusAmount,
              type: 'CREDIT',
              meta: { kind: 'INSURANCE_BONUS', claimId: claim.id, claimType: claim.claimType, auto: true }
            }
          });
          await tx.insurancePool.update({ where: { id: claim.poolId }, data: { balance: { decrement: claim.bonusAmount } } });
        }

        await tx.membership.updateMany({ where: { userId: claim.claimantId, circleId: claim.booking.slot.circle.id }, data: { balanceCredits: { increment: claim.totalPayout } } });
        processed.push({ id: claim.id, bookingId: claim.bookingId, totalPayout: claim.totalPayout });
      }
    });

    return NextResponse.json({ success: true, processed });
  } catch (e) {
    console.error('Cron disputes-auto error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

