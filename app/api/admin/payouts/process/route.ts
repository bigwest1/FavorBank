import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// This endpoint would typically be called by a cron job or scheduled task
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") === "true";

    // Calculate the current week's date range (Monday to Sunday)
    const now = new Date();
    const currentDay = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Sunday = 6 days from Monday
    
    const weekStartDate = new Date(now);
    weekStartDate.setDate(now.getDate() - daysFromMonday);
    weekStartDate.setHours(0, 0, 0, 0);
    
    const weekEndDate = new Date(weekStartDate);
    weekEndDate.setDate(weekStartDate.getDate() + 6);
    weekEndDate.setHours(23, 59, 59, 999);

    // Find all Pro bonuses that haven't been paid out yet and are from last week or earlier
    const unpaidBonuses = await prisma.proBonus.findMany({
      where: {
        payoutId: null,
        accrualDate: {
          lt: weekStartDate // Only bonuses from before current week
        }
      },
      include: {
        user: {
          include: {
            proProfile: true
          }
        }
      }
    });

    if (unpaidBonuses.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No unpaid bonuses found for payout",
        processedPayouts: []
      });
    }

    // Group bonuses by user
    const bonusesByUser = unpaidBonuses.reduce((acc, bonus) => {
      const userId = bonus.userId;
      if (!acc[userId]) {
        acc[userId] = {
          user: bonus.user,
          bonuses: []
        };
      }
      acc[userId].bonuses.push(bonus);
      return acc;
    }, {} as Record<string, { user: any, bonuses: any[] }>);

    const processedPayouts = [];

    // Process payouts for each user
    for (const [userId, { user, bonuses }] of Object.entries(bonusesByUser)) {
      // Skip if user doesn't have Pro profile or Stripe payouts enabled
      if (!user.proProfile || 
          user.proProfile.status !== "APPROVED" ||
          !user.proProfile.stripePayoutsEnabled ||
          !user.proProfile.stripeAccountId) {
        console.log(`Skipping payout for user ${userId}: Pro profile not ready`);
        continue;
      }

      const totalAmount = bonuses.reduce((sum, bonus) => sum + bonus.bonusAmount, 0);
      
      // Skip payouts under $10 (1000 cents) to avoid processing fees
      if (totalAmount < 1000) {
        console.log(`Skipping payout for user ${userId}: Amount too small (${totalAmount} cents)`);
        continue;
      }

      // Calculate payout week range based on bonuses
      const payoutWeekStart = new Date(Math.min(...bonuses.map(b => new Date(b.accrualDate).getTime())));
      const payoutWeekEnd = new Date(Math.max(...bonuses.map(b => new Date(b.accrualDate).getTime())));
      
      payoutWeekStart.setHours(0, 0, 0, 0);
      payoutWeekEnd.setHours(23, 59, 59, 999);

      if (dryRun) {
        processedPayouts.push({
          userId,
          userName: user.name,
          totalAmount,
          bonusCount: bonuses.length,
          weekRange: `${payoutWeekStart.toISOString()} to ${payoutWeekEnd.toISOString()}`,
          action: "DRY_RUN_ONLY"
        });
        continue;
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          // Create payout record
          const payout = await tx.payout.create({
            data: {
              userId: userId,
              status: "PENDING",
              totalAmount: totalAmount,
              bonusCount: bonuses.length,
              weekStartDate: payoutWeekStart,
              weekEndDate: payoutWeekEnd,
              stripeAccountId: user.proProfile.stripeAccountId
            }
          });

          // Update bonuses to reference this payout
          await tx.proBonus.updateMany({
            where: {
              id: {
                in: bonuses.map(b => b.id)
              }
            },
            data: {
              payoutId: payout.id
            }
          });

          // Process Stripe transfer
          try {
            const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
            
            const transfer = await stripe.transfers.create({
              amount: totalAmount,
              currency: "usd",
              destination: user.proProfile.stripeAccountId,
              description: `SlotShop Pro weekly payout for ${bonuses.length} completed bookings`,
              metadata: {
                payoutId: payout.id,
                userId: userId,
                weekStart: payoutWeekStart.toISOString(),
                weekEnd: payoutWeekEnd.toISOString()
              }
            });

            // Update payout with Stripe transfer info
            await tx.payout.update({
              where: { id: payout.id },
              data: {
                status: "PROCESSING",
                stripeTransferId: transfer.id,
                processedAt: new Date()
              }
            });

            return {
              payout,
              transfer,
              success: true
            };

          } catch (stripeError: any) {
            console.error("Stripe transfer failed:", stripeError);
            
            // Update payout status to failed
            await tx.payout.update({
              where: { id: payout.id },
              data: {
                status: "FAILED",
                failureReason: stripeError.message,
                retryCount: 1
              }
            });

            throw new Error(`Stripe transfer failed: ${stripeError.message}`);
          }
        });

        processedPayouts.push({
          userId,
          userName: user.name,
          totalAmount,
          bonusCount: bonuses.length,
          payoutId: result.payout.id,
          stripeTransferId: result.transfer.id,
          weekRange: `${payoutWeekStart.toISOString()} to ${payoutWeekEnd.toISOString()}`,
          status: "PROCESSING"
        });

      } catch (error: any) {
        console.error(`Failed to process payout for user ${userId}:`, error);
        processedPayouts.push({
          userId,
          userName: user.name,
          totalAmount,
          bonusCount: bonuses.length,
          error: error.message,
          status: "FAILED"
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processedPayouts.length} payouts`,
      weekRange: {
        start: weekStartDate.toISOString(),
        end: weekEndDate.toISOString()
      },
      processedPayouts,
      dryRun
    });

  } catch (error: any) {
    console.error("Error processing payouts:", error);
    return NextResponse.json({ 
      error: "Failed to process payouts",
      details: error.message 
    }, { status: 500 });
  }
}