import { prisma } from "@/lib/prisma";

export interface MatchingResult {
  matched: boolean;
  matchAmount: number;
  treasuryId?: string;
  ledgerEntryId?: string;
  reason?: string;
}

/**
 * Process credit matching for a completed booking
 * This is called from the booking completion endpoint
 */
export async function processBookingMatch(
  bookingId: string,
  transaction?: any
): Promise<MatchingResult> {
  const tx = transaction || prisma;

  try {
    // Get booking with treasury info
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        circle: {
          include: {
            treasury: true
          }
        },
        provider: {
          select: { id: true }
        }
      }
    });

    if (!booking) {
      return { matched: false, matchAmount: 0, reason: "Booking not found" };
    }

    const treasury = booking.circle.treasury;

    if (!treasury) {
      return { matched: false, matchAmount: 0, reason: "No treasury configured for circle" };
    }

    if (!treasury.isMatchingActive) {
      return { matched: false, matchAmount: 0, reason: "Credit matching is disabled" };
    }

    if (treasury.matchRatio <= 0) {
      return { matched: false, matchAmount: 0, reason: "Match ratio is zero or negative" };
    }

    // Calculate match amount
    const baseAmount = booking.totalCredits;
    let matchAmount = Math.floor(baseAmount * treasury.matchRatio);

    // Apply per-booking limit if set
    if (treasury.maxMatchPerBooking && matchAmount > treasury.maxMatchPerBooking) {
      matchAmount = treasury.maxMatchPerBooking;
    }

    if (matchAmount <= 0) {
      return { matched: false, matchAmount: 0, reason: "Calculated match amount is zero" };
    }

    // Check if treasury has sufficient balance
    if (treasury.currentBalance < matchAmount) {
      return { 
        matched: false, 
        matchAmount: 0, 
        reason: `Insufficient treasury balance. Required: ${matchAmount}, Available: ${treasury.currentBalance}` 
      };
    }

    // Process the match
    await tx.circleTreasury.update({
      where: { id: treasury.id },
      data: {
        currentBalance: {
          decrement: matchAmount
        },
        totalMatched: {
          increment: matchAmount
        }
      }
    });

    // Add matched credits to provider's balance
    await tx.membership.updateMany({
      where: {
        userId: booking.providerId,
        circleId: booking.circleId,
        isActive: true
      },
      data: {
        balanceCredits: {
          increment: matchAmount
        }
      }
    });

    // Create ledger entry for the match
    const ledgerEntry = await tx.ledgerEntry.create({
      data: {
        circleId: booking.circleId,
        bookingId: booking.id,
        toUserId: booking.providerId,
        fromUserId: null, // From treasury
        amount: matchAmount,
        type: "CREDIT",
        meta: {
          kind: "TREASURY_MATCH",
          treasuryId: treasury.id,
          baseAmount: baseAmount,
          matchRatio: treasury.matchRatio,
          maxMatchPerBooking: treasury.maxMatchPerBooking
        }
      }
    });

    return {
      matched: true,
      matchAmount: matchAmount,
      treasuryId: treasury.id,
      ledgerEntryId: ledgerEntry.id
    };

  } catch (error: any) {
    console.error("Error processing booking match:", error);
    return { 
      matched: false, 
      matchAmount: 0, 
      reason: `Error: ${error.message}` 
    };
  }
}

/**
 * Get matching statistics for a treasury
 */
export async function getTreasuryMatchingStats(treasuryId: string) {
  try {
    // Get total matched amounts
    const treasury = await prisma.circleTreasury.findUnique({
      where: { id: treasuryId }
    });

    if (!treasury) {
      throw new Error("Treasury not found");
    }

    // Get recent matching transactions
    const recentMatches = await prisma.ledgerEntry.findMany({
      where: {
        meta: {
          path: ["kind"],
          equals: "TREASURY_MATCH"
        },
        meta: {
          path: ["treasuryId"],
          equals: treasuryId
        }
      },
      include: {
        booking: {
          select: {
            id: true,
            totalCredits: true,
            provider: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { timestamp: "desc" },
      take: 10
    });

    // Calculate this month's matching
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthMatches = await prisma.ledgerEntry.aggregate({
      where: {
        meta: {
          path: ["kind"],
          equals: "TREASURY_MATCH"
        },
        meta: {
          path: ["treasuryId"],
          equals: treasuryId
        },
        timestamp: {
          gte: startOfMonth
        }
      },
      _sum: { amount: true },
      _count: true
    });

    return {
      totalMatched: treasury.totalMatched,
      currentBalance: treasury.currentBalance,
      isMatchingActive: treasury.isMatchingActive,
      matchRatio: treasury.matchRatio,
      maxMatchPerBooking: treasury.maxMatchPerBooking,
      thisMonthMatched: thisMonthMatches._sum.amount || 0,
      thisMonthMatchCount: thisMonthMatches._count,
      recentMatches: recentMatches.map(match => ({
        id: match.id,
        amount: match.amount,
        timestamp: match.timestamp,
        booking: match.booking,
        baseAmount: match.meta?.baseAmount,
        matchRatio: match.meta?.matchRatio
      }))
    };

  } catch (error: any) {
    console.error("Error getting matching stats:", error);
    throw error;
  }
}