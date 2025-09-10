import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get Pro profile
    const proProfile = await prisma.proProfile.findUnique({
      where: { userId: session.user.id }
    });

    if (!proProfile) {
      return NextResponse.json({ 
        error: "Pro profile not found" 
      }, { status: 404 });
    }

    // Get Pro bonuses
    const proBonuses = await prisma.proBonus.findMany({
      where: { userId: session.user.id },
      include: {
        booking: {
          select: {
            id: true,
            duration: true,
            totalCredits: true,
            completedAt: true
          }
        }
      },
      orderBy: { accrualDate: "desc" }
    });

    // Get payout history
    const payoutHistory = await prisma.payout.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10 // Limit to recent payouts
    });

    // Get skill verifications
    const skillVerifications = await prisma.skillVerification.findMany({
      where: { userId: session.user.id },
      orderBy: { skill: "asc" }
    });

    // Calculate stats
    const totalEarnings = proBonuses
      .filter(bonus => bonus.payoutId) // Only count paid out bonuses
      .reduce((sum, bonus) => sum + bonus.bonusAmount, 0);

    const pendingEarnings = proBonuses
      .filter(bonus => !bonus.payoutId) // Only count unpaid bonuses
      .reduce((sum, bonus) => sum + bonus.bonusAmount, 0);

    const completedBookings = proBonuses.length;

    const averageBonus = completedBookings > 0 
      ? Math.round(proBonuses.reduce((sum, bonus) => sum + bonus.bonusAmount, 0) / completedBookings)
      : 0;

    return NextResponse.json({
      proProfile,
      stats: {
        totalEarnings,
        pendingEarnings,
        completedBookings,
        averageBonus
      },
      recentBonuses: proBonuses.slice(0, 10), // Last 10 bonuses
      payoutHistory,
      skillVerifications
    });

  } catch (error: any) {
    console.error("Error fetching Pro dashboard data:", error);
    return NextResponse.json({ 
      error: "Failed to load dashboard data",
      details: error.message 
    }, { status: 500 });
  }
}