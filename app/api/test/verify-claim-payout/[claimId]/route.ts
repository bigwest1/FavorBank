import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { claimId: string } }
) {
  try {
    // Get the resolved claim with all details
    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: params.claimId },
      include: {
        booking: {
          include: {
            slot: {
              include: {
                circle: true
              }
            },
            booker: true,
            provider: true
          }
        },
        pool: true,
        claimant: true,
        respondent: true
      }
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    // Get ledger entries related to this claim
    const ledgerEntries = await prisma.ledgerEntry.findMany({
      where: {
        bookingId: claim.bookingId
      },
      orderBy: { timestamp: "asc" }
    });

    // Get updated membership balance for claimant
    const claimantMembership = await prisma.membership.findFirst({
      where: {
        userId: claim.claimantId,
        circleId: claim.booking.slot.circle.id
      }
    });

    // Get updated insurance pool balance
    const insurancePool = await prisma.insurancePool.findUnique({
      where: { id: claim.poolId }
    });

    return NextResponse.json({
      success: true,
      claim: {
        id: claim.id,
        status: claim.status,
        resolvedAt: claim.resolvedAt,
        autoResolved: claim.autoResolved,
        amount: claim.amount,
        bonusAmount: claim.bonusAmount,
        totalPayout: claim.totalPayout
      },
      claimant: {
        id: claim.claimant.id,
        name: claim.claimant.name,
        currentBalance: claimantMembership?.balanceCredits || 0
      },
      booking: {
        id: claim.booking.id,
        totalCredits: claim.booking.totalCredits,
        isGuaranteed: claim.booking.isGuaranteed,
        booker: claim.booking.booker.name,
        provider: claim.booking.provider.name
      },
      insurancePool: {
        id: insurancePool?.id,
        currentBalance: insurancePool?.balance || 0
      },
      ledgerEntries: ledgerEntries.map(entry => ({
        id: entry.id,
        amount: entry.amount,
        type: entry.type,
        fromUserId: entry.fromUserId,
        toUserId: entry.toUserId,
        meta: entry.meta,
        timestamp: entry.timestamp
      })),
      verification: {
        claimApproved: claim.status === "APPROVED",
        refundProcessed: ledgerEntries.some(e => 
          e.meta && 
          typeof e.meta === "object" && 
          "kind" in e.meta && 
          e.meta.kind === "INSURANCE_CLAIM_REFUND"
        ),
        bonusProcessed: ledgerEntries.some(e => 
          e.meta && 
          typeof e.meta === "object" && 
          "kind" in e.meta && 
          e.meta.kind === "INSURANCE_BONUS"
        ),
        totalPayoutCorrect: claim.totalPayout === claim.amount + claim.bonusAmount
      }
    });
  } catch (error: any) {
    console.error("Error verifying claim payout:", error);
    return NextResponse.json({ 
      error: "Failed to verify claim payout", 
      details: error.message 
    }, { status: 500 });
  }
}