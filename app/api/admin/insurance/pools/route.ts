import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all insurance pools with circle information
    const pools = await prisma.insurancePool.findMany({
      include: {
        circle: {
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                memberships: true
              }
            }
          }
        }
      },
      orderBy: {
        balance: "desc"
      }
    });

    // Get insurance statistics
    const stats = await prisma.$queryRaw<Array<{
      totalPremiums: bigint;
      totalPayouts: bigint;
      totalClaims: bigint;
      approvedClaims: bigint;
    }>>`
      SELECT 
        COALESCE(SUM(CASE WHEN le.type = 'ADJUSTMENT' AND le.meta->>'$.kind' = 'insurance_premium' THEN le.amount ELSE 0 END), 0) as totalPremiums,
        COALESCE(SUM(CASE WHEN le.type = 'ADJUSTMENT' AND le.meta->>'$.kind' = 'insurance_payout' THEN le.amount ELSE 0 END), 0) as totalPayouts,
        COALESCE((SELECT COUNT(*) FROM InsuranceClaim), 0) as totalClaims,
        COALESCE((SELECT COUNT(*) FROM InsuranceClaim WHERE status = 'APPROVED'), 0) as approvedClaims
      FROM LedgerEntry le
    `;

    const statsData = stats[0];

    return NextResponse.json({
      pools: pools.map(pool => ({
        circleId: pool.circleId,
        circleName: pool.circle.name,
        balance: pool.balance,
        memberCount: pool.circle._count.memberships,
        createdAt: pool.createdAt,
        updatedAt: pool.updatedAt
      })),
      stats: {
        totalPremiums: Number(statsData.totalPremiums),
        totalPayouts: Number(statsData.totalPayouts),
        totalClaims: Number(statsData.totalClaims),
        approvedClaims: Number(statsData.approvedClaims),
        totalPoolBalance: pools.reduce((sum, pool) => sum + pool.balance, 0)
      }
    });

  } catch (error) {
    console.error("Error fetching insurance pool data:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}