import { prisma } from "@/lib/prisma";
import { deposit } from "@/lib/credits/ledger";

interface PlusUser {
  id: string;
  plusSubscription: {
    id: string;
    status: string;
    currentPeriodEnd: Date;
    disputesUsedThisMonth: number;
    lastMonthReset: Date | null;
    lastCreditGrant: Date | null;
  } | null;
}

export class PlusService {
  /**
   * Check if user has an active Plus subscription
   */
  static async isUserPlus(userId: string): Promise<boolean> {
    const subscription = await prisma.plusSubscription.findUnique({
      where: { userId },
    });

    return subscription?.status === "ACTIVE" && 
           subscription.currentPeriodEnd > new Date();
  }

  /**
   * Get user's Plus subscription details
   */
  static async getUserPlusDetails(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        plusSubscription: true,
      },
    });

    if (!user?.plusSubscription) {
      return null;
    }

    const isActive = user.plusSubscription.status === "ACTIVE" && 
                    user.plusSubscription.currentPeriodEnd > new Date();

    return {
      ...user.plusSubscription,
      isActive,
    };
  }

  /**
   * Create a Plus subscription for a user
   */
  static async createPlusSubscription(
    userId: string, 
    periodEnd: Date,
    stripeDetails?: {
      subscriptionId: string;
      priceId: string;
      customerId: string;
    }
  ) {
    const now = new Date();
    
    const subscription = await prisma.plusSubscription.create({
      data: {
        userId,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        stripeSubscriptionId: stripeDetails?.subscriptionId,
        stripePriceId: stripeDetails?.priceId,
        stripeCustomerId: stripeDetails?.customerId,
        lastMonthReset: now,
      },
    });

    // Grant initial monthly credits
    await this.grantMonthlyCredits(userId);

    return subscription;
  }

  /**
   * Grant monthly 100 credits to Plus users
   */
  static async grantMonthlyCredits(userId: string): Promise<boolean> {
    const subscription = await prisma.plusSubscription.findUnique({
      where: { userId },
    });

    if (!subscription || subscription.status !== "ACTIVE") {
      return false;
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Check if credits already granted this month
    const existingGrant = await prisma.plusCreditGrant.findUnique({
      where: {
        userId_grantedForYear_grantedForMonth: {
          userId,
          grantedForYear: currentYear,
          grantedForMonth: currentMonth,
        },
      },
    });

    if (existingGrant) {
      return false; // Already granted this month
    }

    // Grant 100 credits via transaction
    await prisma.$transaction(async (tx) => {
      // Record the credit grant
      await tx.plusCreditGrant.create({
        data: {
          userId,
          amount: 100,
          grantedForMonth: currentMonth,
          grantedForYear: currentYear,
        },
      });

      // Add credits to user's membership (use their primary membership)
      const membership = await tx.membership.findFirst({
        where: { userId, isActive: true },
        orderBy: { joinedAt: "asc" },
      });

      if (membership) {
        await addCredits(tx, membership.circleId, userId, 100, null, {
          kind: "PLUS_CREDIT_GRANT",
          month: currentMonth,
          year: currentYear,
          amount: 100,
        });

        // Update last credit grant timestamp
        await tx.plusSubscription.update({
          where: { userId },
          data: { lastCreditGrant: now },
        });
      }
    });

    return true;
  }

  /**
   * Check if user can use auto-win dispute this month
   */
  static async canAutoWinDispute(userId: string, disputeAmount: number): Promise<boolean> {
    if (disputeAmount >= 50) {
      return false; // Only disputes < 50 credits
    }

    const subscription = await prisma.plusSubscription.findUnique({
      where: { userId },
    });

    if (!subscription || subscription.status !== "ACTIVE") {
      return false;
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Check if already used auto-win this month
    const existingAutoWin = await prisma.plusAutoWinDispute.findUnique({
      where: {
        userId_usedForYear_usedForMonth: {
          userId,
          usedForYear: currentYear,
          usedForMonth: currentMonth,
        },
      },
    });

    return !existingAutoWin;
  }

  /**
   * Use auto-win dispute for a claim
   */
  static async useAutoWinDispute(userId: string, claimId: string, amount: number): Promise<boolean> {
    if (!await this.canAutoWinDispute(userId, amount)) {
      return false;
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    await prisma.plusAutoWinDispute.create({
      data: {
        userId,
        originalClaimId: claimId,
        disputeAmount: amount,
        usedForMonth: currentMonth,
        usedForYear: currentYear,
      },
    });

    return true;
  }

  /**
   * Check if user should have platform fees waived
   */
  static async shouldWaivePlatformFees(userId: string): Promise<boolean> {
    return await this.isUserPlus(userId);
  }

  /**
   * Get Plus scheduling horizon (2 weeks vs standard 1 week)
   */
  static async getSchedulingHorizonDays(userId: string): Promise<number> {
    const isPlus = await this.isUserPlus(userId);
    return isPlus ? 14 : 7; // Plus users get 2 weeks, others get 1 week
  }

  /**
   * Reset monthly counters (should be called monthly via cron)
   */
  static async resetMonthlyCounters(): Promise<void> {
    const now = new Date();
    
    await prisma.plusSubscription.updateMany({
      where: { status: "ACTIVE" },
      data: {
        disputesUsedThisMonth: 0,
        lastMonthReset: now,
      },
    });
  }

  /**
   * Grant monthly credits to all Plus users (should be called monthly via cron)
   */
  static async grantMonthlyCreditsToAllUsers(): Promise<number> {
    const activeSubscriptions = await prisma.plusSubscription.findMany({
      where: { 
        status: "ACTIVE",
        currentPeriodEnd: { gt: new Date() },
      },
    });

    let grantedCount = 0;
    
    for (const subscription of activeSubscriptions) {
      const granted = await this.grantMonthlyCredits(subscription.userId);
      if (granted) {
        grantedCount++;
      }
    }

    return grantedCount;
  }

  /**
   * Cancel Plus subscription
   */
  static async cancelSubscription(userId: string, immediate = false): Promise<void> {
    const status = immediate ? "EXPIRED" : "CANCELLED";
    
    await prisma.plusSubscription.update({
      where: { userId },
      data: { status },
    });
  }

  /**
   * Reactivate Plus subscription
   */
  static async reactivateSubscription(userId: string, newPeriodEnd: Date): Promise<void> {
    await prisma.plusSubscription.update({
      where: { userId },
      data: {
        status: "ACTIVE",
        currentPeriodEnd: newPeriodEnd,
        autoRenew: true,
      },
    });
  }

  /**
   * Get Plus statistics for a user
   */
  static async getUserPlusStats(userId: string) {
    const [subscription, creditGrants, disputes] = await Promise.all([
      prisma.plusSubscription.findUnique({
        where: { userId },
      }),
      prisma.plusCreditGrant.count({
        where: { userId },
      }),
      prisma.plusAutoWinDispute.count({
        where: { userId },
      }),
    ]);

    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    const thisMonthCredits = await prisma.plusCreditGrant.findUnique({
      where: {
        userId_grantedForYear_grantedForMonth: {
          userId,
          grantedForYear: currentYear,
          grantedForMonth: currentMonth,
        },
      },
    });

    const thisMonthDispute = await prisma.plusAutoWinDispute.findUnique({
      where: {
        userId_usedForYear_usedForMonth: {
          userId,
          usedForYear: currentYear,
          usedForMonth: currentMonth,
        },
      },
    });

    return {
      subscription,
      totalCreditGrants: creditGrants,
      totalAutoWinDisputes: disputes,
      thisMonthCreditsGranted: !!thisMonthCredits,
      thisMonthDisputeUsed: !!thisMonthDispute,
      canUseAutoWinThisMonth: !thisMonthDispute && subscription?.status === "ACTIVE",
    };
  }
}