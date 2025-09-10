import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { insurancePremium, insurancePayout } from "@/lib/credits/ledger";

export async function POST(request: NextRequest) {
  try {
    const { action, userId, circleId, bookingId, amount, ...options } = await request.json();

    switch (action) {
      case "create_mock_booking":
        // Create a mock MOVING or FURNITURE booking with insurance
        const category = options.category || "MOVING";
        
        // Ensure user exists
        await prisma.user.upsert({
          where: { id: userId },
          update: {},
          create: {
            id: userId,
            email: `${userId}@test.com`,
            name: `Test User ${userId}`,
            isActive: true
          }
        });

        // Create mock slot
        const slot = await prisma.slot.create({
          data: {
            providerId: "mock-provider",
            circleId,
            title: `Test ${category.toLowerCase()} service`,
            description: `Mock ${category.toLowerCase()} slot for insurance testing`,
            category,
            start: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
            end: new Date(Date.now() + 25 * 60 * 60 * 1000), // Tomorrow + 1 hour
            pricePerMinute: 1,
            minDuration: 60,
            maxDuration: 120,
            status: "OPEN"
          }
        });

        // Create mock booking with insurance
        const booking = await prisma.booking.create({
          data: {
            slotId: slot.id,
            providerId: "mock-provider",
            bookerId: userId,
            circleId,
            duration: 60,
            totalCredits: 62, // 60 for service + 2 for insurance
            hasInsurance: true,
            status: "COMPLETED" // Make it completed so claims can be made
          }
        });

        return NextResponse.json({
          success: true,
          message: "Mock insured booking created",
          booking: {
            id: booking.id,
            category,
            hasInsurance: true,
            totalCredits: booking.totalCredits
          }
        });

      case "purchase_insurance":
        // Manually purchase insurance for existing booking
        const existingBooking = await prisma.booking.findUnique({
          where: { id: bookingId },
          include: { slot: true }
        });

        if (!existingBooking) {
          return NextResponse.json({
            success: false,
            message: "Booking not found"
          }, { status: 404 });
        }

        if (existingBooking.hasInsurance) {
          return NextResponse.json({
            success: false,
            message: "Booking already has insurance"
          }, { status: 400 });
        }

        const isEligible = existingBooking.slot.category === "MOVING" || 
                          existingBooking.slot.category === "FURNITURE";

        if (!isEligible) {
          return NextResponse.json({
            success: false,
            message: "Booking category not eligible for insurance"
          }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
          // Update booking to have insurance
          await tx.booking.update({
            where: { id: bookingId },
            data: { 
              hasInsurance: true,
              totalCredits: { increment: 2 }
            }
          });

          // Process insurance premium
          await insurancePremium(tx, existingBooking.circleId, userId, 2, {
            bookingId,
            slotId: existingBooking.slotId,
            category: existingBooking.slot.category,
            coverageAmount: 500
          });
        });

        return NextResponse.json({
          success: true,
          message: "Insurance purchased successfully",
          premiumPaid: 2
        });

      case "file_claim":
        // File an insurance claim
        const claimAmount = amount || 100; // Default $100 damage
        const description = options.description || "Test damage claim for insurance simulation";

        const response = await fetch(`${process.env.NEXTAUTH_URL}/api/insurance/claim`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // In real app, this would use actual session
          },
          body: JSON.stringify({
            bookingId,
            amount: claimAmount,
            description
          })
        });

        if (!response.ok) {
          const error = await response.json();
          return NextResponse.json({
            success: false,
            message: error.error || "Failed to file claim"
          }, { status: response.status });
        }

        const claimResult = await response.json();
        return NextResponse.json({
          success: true,
          message: "Insurance claim filed and processed",
          claim: claimResult.claim,
          payout: claimAmount
        });

      case "get_pool_balance":
        // Get insurance pool balance for circle
        const pool = await prisma.insurancePool.findUnique({
          where: { circleId },
          include: {
            circle: {
              select: { name: true }
            }
          }
        });

        if (!pool) {
          return NextResponse.json({
            success: false,
            message: "Insurance pool not found for this circle"
          }, { status: 404 });
        }

        return NextResponse.json({
          success: true,
          pool: {
            circleId,
            circleName: pool.circle.name,
            balance: pool.balance
          }
        });

      case "fund_pool":
        // Add funds to insurance pool (admin function)
        const fundAmount = amount || 1000;
        
        await prisma.$transaction(async (tx) => {
          // Ensure pool exists
          await tx.insurancePool.upsert({
            where: { circleId },
            update: { balance: { increment: fundAmount } },
            create: { circleId, balance: fundAmount }
          });
        });

        return NextResponse.json({
          success: true,
          message: `Added ${fundAmount} to insurance pool`,
          fundAmount
        });

      case "get_insurance_stats":
        // Get comprehensive insurance statistics
        const bookingsWithInsurance = await prisma.booking.count({
          where: { 
            circleId,
            hasInsurance: true 
          }
        });

        const totalClaims = await prisma.insuranceClaim.count({
          where: {
            booking: { circleId }
          }
        });

        const approvedClaims = await prisma.insuranceClaim.count({
          where: {
            booking: { circleId },
            status: "APPROVED"
          }
        });

        const poolBalance = await prisma.insurancePool.findUnique({
          where: { circleId },
          select: { balance: true }
        });

        return NextResponse.json({
          success: true,
          stats: {
            circleId,
            bookingsWithInsurance,
            totalClaims,
            approvedClaims,
            claimApprovalRate: totalClaims > 0 ? (approvedClaims / totalClaims) * 100 : 0,
            poolBalance: poolBalance?.balance || 0
          }
        });

      default:
        return NextResponse.json({
          error: "Invalid action",
          availableActions: [
            "create_mock_booking",
            "purchase_insurance", 
            "file_claim",
            "get_pool_balance",
            "fund_pool",
            "get_insurance_stats"
          ]
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Error in insurance simulation:", error);
    return NextResponse.json({
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}