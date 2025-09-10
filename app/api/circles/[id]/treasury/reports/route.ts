import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const circleId = params.id;
    const url = new URL(request.url);
    const period = url.searchParams.get("period") || "month"; // month, quarter, year
    
    // Verify user has access to this circle
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        circleId: circleId,
        isActive: true
      }
    });

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get circle with treasury
    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
      include: {
        treasury: true,
        memberships: {
          where: { isActive: true },
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    if (!circle || !circle.treasury) {
      return NextResponse.json({ error: "Treasury not found" }, { status: 404 });
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case "quarter":
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // 1. Participation Report - Hours traded and activity levels
    const participationData = await prisma.booking.groupBy({
      by: ['providerId'],
      where: {
        circleId: circleId,
        status: 'COMPLETED',
        endTime: {
          gte: startDate
        }
      },
      _count: {
        id: true
      },
      _sum: {
        duration: true,
        totalCredits: true
      }
    });

    // Get provider names for participation data
    const providerIds = participationData.map(p => p.providerId);
    const providers = await prisma.user.findMany({
      where: { id: { in: providerIds } },
      select: { id: true, name: true }
    });

    const providerMap = new Map(providers.map(p => [p.id, p.name]));

    const participationReport = participationData.map(p => ({
      providerId: p.providerId,
      providerName: providerMap.get(p.providerId) || "Unknown",
      bookingsCompleted: p._count.id,
      totalHours: Math.round((p._sum.duration || 0) / 60 * 10) / 10, // Convert minutes to hours
      creditsEarned: p._sum.totalCredits || 0
    })).sort((a, b) => b.creditsEarned - a.creditsEarned);

    // 2. Treasury Budget Analysis
    const treasuryTransactions = await prisma.ledgerEntry.findMany({
      where: {
        circleId: circleId,
        timestamp: {
          gte: startDate
        },
        OR: [
          { meta: { path: ["kind"], equals: "TREASURY_FUNDING" } },
          { meta: { path: ["kind"], equals: "TREASURY_ALLOWANCE" } },
          { meta: { path: ["kind"], equals: "TREASURY_MATCH" } }
        ]
      },
      orderBy: { timestamp: "desc" }
    });

    const budgetAnalysis = {
      funding: {
        transactions: treasuryTransactions.filter(t => t.meta?.kind === "TREASURY_FUNDING").length,
        totalAmount: treasuryTransactions
          .filter(t => t.meta?.kind === "TREASURY_FUNDING")
          .reduce((sum, t) => sum + t.amount, 0)
      },
      allowances: {
        transactions: treasuryTransactions.filter(t => t.meta?.kind === "TREASURY_ALLOWANCE").length,
        totalAmount: treasuryTransactions
          .filter(t => t.meta?.kind === "TREASURY_ALLOWANCE")
          .reduce((sum, t) => sum + t.amount, 0)
      },
      matching: {
        transactions: treasuryTransactions.filter(t => t.meta?.kind === "TREASURY_MATCH").length,
        totalAmount: treasuryTransactions
          .filter(t => t.meta?.kind === "TREASURY_MATCH")
          .reduce((sum, t) => sum + t.amount, 0)
      }
    };

    // 3. Member Activity and Balances
    const memberActivity = await Promise.all(
      circle.memberships.map(async (membership) => {
        // Get bookings as provider
        const asProvider = await prisma.booking.aggregate({
          where: {
            providerId: membership.userId,
            circleId: circleId,
            status: 'COMPLETED',
            endTime: {
              gte: startDate
            }
          },
          _count: { id: true },
          _sum: { duration: true, totalCredits: true }
        });

        // Get bookings as booker
        const asBooker = await prisma.booking.aggregate({
          where: {
            bookerId: membership.userId,
            circleId: circleId,
            status: 'COMPLETED',
            endTime: {
              gte: startDate
            }
          },
          _count: { id: true },
          _sum: { duration: true, totalCredits: true }
        });

        return {
          userId: membership.userId,
          userName: membership.user.name || "Unknown",
          currentBalance: membership.balanceCredits,
          role: membership.role,
          servicesProvided: asProvider._count.id,
          servicesReceived: asBooker._count.id,
          hoursProvided: Math.round((asProvider._sum.duration || 0) / 60 * 10) / 10,
          hoursReceived: Math.round((asBooker._sum.duration || 0) / 60 * 10) / 10,
          creditsEarned: asProvider._sum.totalCredits || 0,
          creditsSpent: asBooker._sum.totalCredits || 0,
          netCredits: (asProvider._sum.totalCredits || 0) - (asBooker._sum.totalCredits || 0)
        };
      })
    );

    // 4. Treasury Health Metrics
    const currentBalance = circle.treasury.currentBalance;
    const totalFunded = circle.treasury.totalFunded;
    const totalDistributed = circle.treasury.totalDistributed;
    const totalMatched = circle.treasury.totalMatched;
    
    // Calculate monthly burn rate (allowances + matching)
    const monthlyBurn = budgetAnalysis.allowances.totalAmount + budgetAnalysis.matching.totalAmount;
    const monthsRemaining = currentBalance > 0 && monthlyBurn > 0 ? 
      Math.floor(currentBalance / monthlyBurn) : null;

    const healthMetrics = {
      currentBalance,
      totalFunded,
      totalDistributed,
      totalMatched,
      utilisationRate: totalFunded > 0 ? 
        Math.round((totalDistributed + totalMatched) / totalFunded * 100) : 0,
      monthlyBurn,
      monthsRemaining,
      averageAllowancePerMember: circle.treasury.allowancePerMember,
      activeMembers: circle.memberships.length
    };

    // 5. Recent Activity Summary
    const recentActivity = treasuryTransactions.slice(0, 10).map(transaction => ({
      id: transaction.id,
      type: transaction.meta?.kind || "UNKNOWN",
      amount: transaction.amount,
      timestamp: transaction.timestamp,
      userId: transaction.toUserId || transaction.fromUserId,
      metadata: transaction.meta
    }));

    return NextResponse.json({
      period,
      startDate,
      endDate: now,
      circle: {
        id: circle.id,
        name: circle.name,
        memberCount: circle.memberships.length
      },
      treasury: {
        id: circle.treasury.id,
        isAllowanceActive: circle.treasury.isAllowanceActive,
        isMatchingActive: circle.treasury.isMatchingActive,
        matchRatio: circle.treasury.matchRatio
      },
      reports: {
        participation: participationReport,
        budgetAnalysis,
        memberActivity: memberActivity.sort((a, b) => b.creditsEarned - a.creditsEarned),
        healthMetrics,
        recentActivity
      }
    });

  } catch (error: any) {
    console.error("Error generating treasury reports:", error);
    return NextResponse.json({ 
      error: "Failed to generate reports",
      details: error.message 
    }, { status: 500 });
  }
}