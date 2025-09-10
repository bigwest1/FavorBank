import { prisma } from "@/lib/prisma";

interface FeeContext {
  circleId: string;
  userId: string;
  bookingId?: string;
  transactionType: "booking" | "purchase" | "exchange";
  feeBreakdown: {
    baseAmount: number;
    fees: Array<{
      id: string;
      name: string;
      percentage: number;
      amount: number;
    }>;
    totalSurcharge: number;
    finalAmount: number;
    capped: boolean;
    capReason?: string;
  };
}

/**
 * Record fee surcharge entries in the ledger
 */
export async function recordFeeSurcharge(
  context: FeeContext, 
  transaction?: any
): Promise<void> {
  const tx = transaction || prisma;

  if (context.feeBreakdown.totalSurcharge <= 0) {
    return; // No fees to record
  }

  try {
    // Create a single ledger entry for all fees combined
    await tx.ledgerEntry.create({
      data: {
        circleId: context.circleId,
        bookingId: context.bookingId || null,
        fromUserId: context.userId,
        toUserId: null, // Fees go to the system/circle
        amount: context.feeBreakdown.totalSurcharge,
        type: "DEBIT", // User pays the fee
        meta: {
          kind: "FEE_SURCHARGE",
          transactionType: context.transactionType,
          baseAmount: context.feeBreakdown.baseAmount,
          finalAmount: context.feeBreakdown.finalAmount,
          totalSurchargeAmount: context.feeBreakdown.totalSurcharge,
          feesApplied: context.feeBreakdown.fees.map(fee => ({
            id: fee.id,
            name: fee.name,
            percentage: fee.percentage,
            amount: fee.amount
          })),
          capped: context.feeBreakdown.capped,
          capReason: context.feeBreakdown.capReason
        }
      }
    });

    console.log(`Recorded fee surcharge: ${context.feeBreakdown.totalSurcharge} credits for ${context.transactionType}`);

  } catch (error) {
    console.error("Error recording fee surcharge:", error);
    throw error;
  }
}

/**
 * Get fee statistics for a circle
 */
export async function getCircleFeeStats(circleId: string, period?: "week" | "month" | "quarter") {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "quarter":
      startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1); // Default to current month
  }

  try {
    // Get all fee surcharge entries for the period
    const feeEntries = await prisma.ledgerEntry.findMany({
      where: {
        circleId: circleId,
        meta: {
          path: "$.kind",
          equals: "FEE_SURCHARGE"
        },
        timestamp: {
          gte: startDate
        }
      },
      orderBy: { timestamp: "desc" }
    });

    // Calculate statistics
    const totalFeesCollected = feeEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const feeTransactionCount = feeEntries.length;
    
    // Count fee types
    const feeTypeStats: Record<string, { count: number; amount: number }> = {};
    
    feeEntries.forEach(entry => {
      const feesApplied = entry.meta?.feesApplied as Array<{ id: string; name: string; amount: number }> || [];
      feesApplied.forEach(fee => {
        if (!feeTypeStats[fee.id]) {
          feeTypeStats[fee.id] = { count: 0, amount: 0 };
        }
        feeTypeStats[fee.id].count++;
        feeTypeStats[fee.id].amount += fee.amount;
      });
    });

    return {
      period,
      startDate,
      endDate: now,
      totalFeesCollected,
      feeTransactionCount,
      averageFeePerTransaction: feeTransactionCount > 0 ? 
        Math.round(totalFeesCollected / feeTransactionCount) : 0,
      feeTypeStats,
      recentFees: feeEntries.slice(0, 10).map(entry => ({
        id: entry.id,
        amount: entry.amount,
        timestamp: entry.timestamp,
        userId: entry.fromUserId,
        bookingId: entry.bookingId,
        transactionType: entry.meta?.transactionType,
        baseAmount: entry.meta?.baseAmount,
        finalAmount: entry.meta?.finalAmount,
        feesApplied: entry.meta?.feesApplied
      }))
    };

  } catch (error) {
    console.error("Error getting circle fee stats:", error);
    throw error;
  }
}

/**
 * Get user's fee history
 */
export async function getUserFeeHistory(userId: string, limit: number = 20) {
  try {
    const feeEntries = await prisma.ledgerEntry.findMany({
      where: {
        fromUserId: userId,
        meta: {
          path: ["kind"],
          equals: "FEE_SURCHARGE"
        }
      },
      include: {
        circle: {
          select: { id: true, name: true }
        },
        booking: {
          select: { 
            id: true, 
            slot: { 
              select: { title: true, category: true } 
            } 
          }
        }
      },
      orderBy: { timestamp: "desc" },
      take: limit
    });

    return feeEntries.map(entry => ({
      id: entry.id,
      amount: entry.amount,
      timestamp: entry.timestamp,
      circle: entry.circle,
      booking: entry.booking,
      transactionType: entry.meta?.transactionType,
      baseAmount: entry.meta?.baseAmount,
      finalAmount: entry.meta?.finalAmount,
      feesApplied: entry.meta?.feesApplied,
      capped: entry.meta?.capped
    }));

  } catch (error) {
    console.error("Error getting user fee history:", error);
    throw error;
  }
}

/**
 * Calculate total fees saved by capping for a user
 */
export async function getUserFeesSaved(userId: string, period?: "month" | "quarter" | "year") {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "quarter":
      startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
      break;
    case "year":
      startDate = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  try {
    const feeEntries = await prisma.ledgerEntry.findMany({
      where: {
        fromUserId: userId,
        meta: {
          path: "$.kind",
          equals: "FEE_SURCHARGE"
        },
        timestamp: {
          gte: startDate
        }
      }
    });

    // Calculate what fees would have been without capping
    let totalActualFees = 0;
    let totalUncappedFees = 0;
    let cappedTransactions = 0;

    feeEntries.forEach(entry => {
      const baseAmount = entry.meta?.baseAmount as number || 0;
      const feesApplied = entry.meta?.feesApplied as Array<{ amount: number }> || [];
      const capped = entry.meta?.capped as boolean || false;

      totalActualFees += entry.amount;

      if (capped) {
        // Calculate what the uncapped fee would have been
        const uncappedFeeAmount = feesApplied.reduce((sum, fee) => sum + fee.amount, 0);
        totalUncappedFees += uncappedFeeAmount;
        cappedTransactions++;
      } else {
        totalUncappedFees += entry.amount;
      }
    });

    const totalSaved = totalUncappedFees - totalActualFees;

    return {
      period,
      startDate,
      endDate: now,
      totalActualFees,
      totalUncappedFees,
      totalSaved,
      cappedTransactions,
      totalTransactions: feeEntries.length,
      savingsPercentage: totalUncappedFees > 0 ? 
        Math.round((totalSaved / totalUncappedFees) * 100) : 0
    };

  } catch (error) {
    console.error("Error calculating user fees saved:", error);
    throw error;
  }
}