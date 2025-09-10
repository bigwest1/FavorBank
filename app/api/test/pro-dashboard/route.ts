import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Find the test Pro user we created
    const proUser = await prisma.user.findFirst({
      where: { email: "pro-test@favorbank.test" }
    });

    if (!proUser) {
      return NextResponse.json({ 
        error: "Test Pro user not found. Run /api/test/pro-simulation first." 
      }, { status: 404 });
    }

    // Get Pro profile
    const proProfile = await prisma.proProfile.findUnique({
      where: { userId: proUser.id }
    });

    if (!proProfile) {
      return NextResponse.json({ 
        error: "Pro profile not found" 
      }, { status: 404 });
    }

    // Get Pro bonuses
    const proBonuses = await prisma.proBonus.findMany({
      where: { userId: proUser.id },
      include: {
        booking: {
          select: {
            id: true,
            duration: true,
            totalCredits: true,
            endTime: true
          }
        }
      },
      orderBy: { accrualDate: "desc" }
    });

    // Get payout history
    const payoutHistory = await prisma.payout.findMany({
      where: { userId: proUser.id },
      orderBy: { createdAt: "desc" },
      take: 10
    });

    // Get skill verifications
    const skillVerifications = await prisma.skillVerification.findMany({
      where: { userId: proUser.id },
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
      user: {
        id: proUser.id,
        name: proUser.name,
        email: proUser.email
      },
      proProfile,
      stats: {
        totalEarnings,
        pendingEarnings,
        completedBookings,
        averageBonus
      },
      recentBonuses: proBonuses.slice(0, 10),
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