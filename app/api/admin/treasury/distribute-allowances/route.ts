import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { treasuryId, month, year } = body;

    // Validate inputs
    if (!treasuryId || !month || !year) {
      return NextResponse.json({ 
        error: "Treasury ID, month, and year are required" 
      }, { status: 400 });
    }

    if (month < 1 || month > 12) {
      return NextResponse.json({ 
        error: "Month must be between 1 and 12" 
      }, { status: 400 });
    }

    // Check if distribution already exists
    const existingDistribution = await prisma.allowanceDistribution.findFirst({
      where: {
        treasuryId: treasuryId,
        month: month,
        year: year
      }
    });

    if (existingDistribution) {
      return NextResponse.json({ 
        error: "Allowances have already been distributed for this month" 
      }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Get treasury with settings
      const treasury = await tx.circleTreasury.findUnique({
        where: { id: treasuryId },
        include: { 
          circle: { 
            include: { 
              memberships: { 
                where: { isActive: true },
                select: { 
                  id: true, 
                  userId: true, 
                  balanceCredits: true 
                }
              } 
            } 
          } 
        }
      });

      if (!treasury) {
        throw new Error("Treasury not found");
      }

      if (!treasury.isAllowanceActive) {
        throw new Error("Monthly allowances are not enabled for this treasury");
      }

      if (treasury.allowancePerMember <= 0) {
        throw new Error("Allowance per member must be greater than 0");
      }

      const members = treasury.circle.memberships;
      const totalRequired = members.length * treasury.allowancePerMember;

      // Check if treasury has sufficient balance
      if (treasury.currentBalance < totalRequired) {
        throw new Error(
          `Insufficient treasury balance. Required: ${totalRequired}, Available: ${treasury.currentBalance}`
        );
      }

      // Create distribution record
      const distribution = await tx.allowanceDistribution.create({
        data: {
          treasuryId: treasuryId,
          totalAmount: totalRequired,
          memberCount: members.length,
          creditsPerMember: treasury.allowancePerMember,
          month: month,
          year: year,
          status: "PROCESSING",
          startedAt: new Date()
        }
      });

      let successCount = 0;
      let failureCount = 0;
      const errors: string[] = [];

      // Distribute allowances to each member
      for (const member of members) {
        try {
          // Add credits to member's balance
          await tx.membership.update({
            where: { id: member.id },
            data: {
              balanceCredits: {
                increment: treasury.allowancePerMember
              }
            }
          });

          // Create ledger entry for the allowance
          await tx.ledgerEntry.create({
            data: {
              circleId: treasury.circleId,
              toUserId: member.userId,
              fromUserId: null, // From treasury
              amount: treasury.allowancePerMember,
              type: "CREDIT",
              meta: {
                kind: "TREASURY_ALLOWANCE",
                distributionId: distribution.id,
                month: month,
                year: year,
                treasuryId: treasuryId
              }
            }
          });

          successCount++;

        } catch (error: any) {
          failureCount++;
          errors.push(`Failed to distribute to member ${member.userId}: ${error.message}`);
          console.error("Distribution error:", error);
        }
      }

      // Update treasury balances
      const actualDistributed = successCount * treasury.allowancePerMember;
      await tx.circleTreasury.update({
        where: { id: treasuryId },
        data: {
          currentBalance: {
            decrement: actualDistributed
          },
          totalDistributed: {
            increment: actualDistributed
          },
          lastDistribution: new Date()
        }
      });

      // Update distribution status
      const finalStatus = failureCount === 0 ? "COMPLETED" : 
                         successCount === 0 ? "FAILED" : "PARTIAL";

      await tx.allowanceDistribution.update({
        where: { id: distribution.id },
        data: {
          status: finalStatus,
          completedAt: new Date(),
          errorMessage: errors.length > 0 ? errors.join("; ") : null
        }
      });

      return {
        distribution: {
          ...distribution,
          status: finalStatus,
          completedAt: new Date(),
          errorMessage: errors.length > 0 ? errors.join("; ") : null
        },
        successCount,
        failureCount,
        totalRequired,
        actualDistributed,
        errors: errors.length > 0 ? errors : undefined
      };
    });

    return NextResponse.json({
      success: true,
      message: `Distributed ${result.actualDistributed} credits to ${result.successCount} members`,
      data: result
    });

  } catch (error: any) {
    console.error("Error distributing allowances:", error);
    return NextResponse.json({ 
      error: "Failed to distribute allowances",
      details: error.message 
    }, { status: 500 });
  }
}

// GET endpoint to check what distributions are due
export async function GET() {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Find treasuries that have allowances enabled and haven't distributed this month
    const treasuriesNeedingDistribution = await prisma.circleTreasury.findMany({
      where: {
        isAllowanceActive: true,
        allowancePerMember: { gt: 0 },
        NOT: {
          allowanceDistributions: {
            some: {
              month: currentMonth,
              year: currentYear,
              status: { in: ["COMPLETED", "PARTIAL"] }
            }
          }
        }
      },
      include: {
        circle: {
          select: {
            id: true,
            name: true,
            memberships: {
              where: { isActive: true },
              select: { id: true }
            }
          }
        },
        allowanceDistributions: {
          where: {
            month: currentMonth,
            year: currentYear
          },
          orderBy: { createdAt: "desc" },
          take: 1
        }
      }
    });

    const distributionsNeeded = treasuriesNeedingDistribution.map(treasury => {
      const memberCount = treasury.circle.memberships.length;
      const totalRequired = memberCount * treasury.allowancePerMember;
      const canDistribute = treasury.currentBalance >= totalRequired;

      return {
        treasuryId: treasury.id,
        circleName: treasury.circle.name,
        memberCount,
        allowancePerMember: treasury.allowancePerMember,
        totalRequired,
        currentBalance: treasury.currentBalance,
        canDistribute,
        month: currentMonth,
        year: currentYear
      };
    });

    return NextResponse.json({
      month: currentMonth,
      year: currentYear,
      totalTreasuries: distributionsNeeded.length,
      distributionsNeeded
    });

  } catch (error: any) {
    console.error("Error checking distributions needed:", error);
    return NextResponse.json({ 
      error: "Failed to check distributions needed",
      details: error.message 
    }, { status: 500 });
  }
}