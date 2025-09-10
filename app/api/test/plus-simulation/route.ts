import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PlusService } from "@/lib/plus/service";

export async function POST(request: NextRequest) {
  try {
    const { action, userId, ...options } = await request.json();

    switch (action) {
      case "create_plus_user":
        // Create a test Plus subscription
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1); // 1 month from now
        
        const subscription = await PlusService.createPlusSubscription(
          userId,
          periodEnd,
          {
            subscriptionId: `test-sub-${Date.now()}`,
            priceId: "price_test_plus",
            customerId: `cus_test_${userId.slice(-8)}`
          }
        );

        return NextResponse.json({
          success: true,
          message: "Plus subscription created",
          subscription
        });

      case "grant_monthly_credits":
        // Grant monthly credits to user
        const granted = await PlusService.grantMonthlyCredits(userId);
        
        return NextResponse.json({
          success: true,
          message: granted ? "Monthly credits granted" : "Credits already granted this month or user not Plus",
          granted
        });

      case "toggle_plus_status":
        // Toggle Plus status for testing
        const existingSubscription = await prisma.plusSubscription.findUnique({
          where: { userId }
        });

        if (existingSubscription) {
          // Toggle status
          const newStatus = existingSubscription.status === "ACTIVE" ? "EXPIRED" : "ACTIVE";
          await prisma.plusSubscription.update({
            where: { userId },
            data: { status: newStatus }
          });
          
          return NextResponse.json({
            success: true,
            message: `Plus status toggled to ${newStatus}`,
            newStatus
          });
        } else {
          // Create new Plus subscription
          const periodEnd = new Date();
          periodEnd.setMonth(periodEnd.getMonth() + 1);
          
          const newSubscription = await PlusService.createPlusSubscription(
            userId,
            periodEnd
          );
          
          return NextResponse.json({
            success: true,
            message: "Plus subscription created",
            subscription: newSubscription
          });
        }

      case "use_auto_win":
        // Test auto-win dispute functionality
        const claimId = `test-claim-${Date.now()}`;
        const amount = options.amount || 25; // Default 25 credits
        
        const canUse = await PlusService.canAutoWinDispute(userId, amount);
        if (!canUse) {
          return NextResponse.json({
            success: false,
            message: "Cannot use auto-win (not Plus, amount too high, or already used this month)"
          });
        }
        
        const used = await PlusService.useAutoWinDispute(userId, claimId, amount);
        
        return NextResponse.json({
          success: true,
          message: used ? "Auto-win dispute used successfully" : "Failed to use auto-win",
          used,
          claimId,
          amount
        });

      case "check_scheduling_horizon":
        // Test scheduling horizon
        const horizonDays = await PlusService.getSchedulingHorizonDays(userId);
        const isPlus = await PlusService.isUserPlus(userId);
        
        return NextResponse.json({
          success: true,
          isPlus,
          horizonDays,
          message: `User has ${horizonDays}-day scheduling horizon${isPlus ? ' (Plus)' : ' (Standard)'}`
        });

      case "get_plus_stats":
        // Get comprehensive Plus stats
        const stats = await PlusService.getUserPlusStats(userId);
        
        return NextResponse.json({
          success: true,
          stats
        });

      default:
        return NextResponse.json({
          error: "Invalid action",
          availableActions: [
            "create_plus_user",
            "toggle_plus_status", 
            "grant_monthly_credits",
            "use_auto_win",
            "check_scheduling_horizon",
            "get_plus_stats"
          ]
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Error in Plus simulation:", error);
    return NextResponse.json({
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}