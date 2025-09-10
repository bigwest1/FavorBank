import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    // This is a test endpoint to simulate the complete claim flow
    // In production, this would be replaced by actual booking workflows

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create a test user to be the owner/provider
      let testUser = await tx.user.findFirst({
        where: { email: "test-owner@favorbank.test" }
      });

      if (!testUser) {
        testUser = await tx.user.create({
          data: {
            email: "test-owner@favorbank.test",
            name: "Test Owner",
            passwordHash: "test"
          }
        });
      }

      // 2. Find or create a test circle with insurance
      let circle = await tx.circle.findFirst({
        where: { name: "Test Circle" },
        include: { insurance: true }
      });

      if (!circle) {
        circle = await tx.circle.create({
          data: {
            name: "Test Circle",
            description: "Test circle for insurance claims",
            ownerId: testUser.id
          }
        });

        // Create insurance pool for the circle
        const insurancePool = await tx.insurancePool.create({
          data: {
            circleId: circle.id,
            balance: 10000, // Start with 10k credits in pool
            premiumRate: 0.05
          }
        });
        
        // Add insurance to circle object
        circle.insurance = insurancePool;
      } else if (!circle.insurance) {
        // If circle exists but doesn't have insurance loaded, fetch it
        const existingInsurance = await tx.insurancePool.findUnique({
          where: { circleId: circle.id }
        });
        circle.insurance = existingInsurance;
      }

      // 3. Ensure user is a member
      let membership = await tx.membership.findFirst({
        where: {
          userId: testUser.id,
          circleId: circle.id
        }
      });

      if (!membership) {
        membership = await tx.membership.create({
          data: {
            userId: testUser.id,
            circleId: circle.id,
            role: "OWNER",
            balanceCredits: 1000
          }
        });
      }

      // 4. Create a test slot
      const slot = await tx.slot.create({
        data: {
          circleId: circle.id,
          providerId: testUser.id, // Will be provider for this test
          title: "Test Service - Guaranteed",
          category: "OTHER",
          start: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          end: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          pricePerMinute: 2,
          minDuration: 30,
          status: "OPEN"
        }
      });

      // 5. Create a guaranteed booking (simulate someone else booking)
      // For test purposes, we'll create a second user to be the booker
      let testBooker = await tx.user.findFirst({
        where: { email: "test-booker@favorbank.test" }
      });

      if (!testBooker) {
        testBooker = await tx.user.create({
          data: {
            email: "test-booker@favorbank.test",
            name: "Test Booker",
            passwordHash: "test"
          }
        });

        // Add to circle
        await tx.membership.create({
          data: {
            userId: testBooker.id,
            circleId: circle.id,
            role: "MEMBER",
            balanceCredits: 500
          }
        });
      }

      // 6. Create guaranteed booking
      const booking = await tx.booking.create({
        data: {
          slotId: slot.id,
          providerId: testUser.id,
          bookerId: testBooker.id,
          circleId: circle.id,
          status: "CONFIRMED",
          duration: 60, // 1 hour
          totalCredits: 120, // 60 min * 2 credits/min
          isGuaranteed: true,
          guaranteedAt: new Date()
        }
      });

      // 7. Create a claim for no-show
      const claimDeadline = new Date();
      claimDeadline.setMinutes(claimDeadline.getMinutes() + 1); // 1 minute for testing

      const claim = await tx.insuranceClaim.create({
        data: {
          poolId: circle.insurance!.id,
          bookingId: booking.id,
          claimantId: testBooker.id,
          respondentId: testUser.id,
          claimType: "NO_SHOW",
          description: "Provider did not show up for the scheduled appointment",
          amount: 120,
          bonusAmount: 24, // 20% bonus
          totalPayout: 144,
          claimDeadline
        }
      });

      return {
        circle: circle.id,
        booking: booking.id,
        claim: claim.id,
        claimDeadline: claimDeadline.toISOString(),
        testBooker: testBooker.id,
        testOwner: testUser.id
      };
    });

    return NextResponse.json({
      success: true,
      message: "Test claim scenario created successfully",
      data: result,
      instructions: {
        step1: "A guaranteed booking has been created",
        step2: "A no-show claim has been filed",
        step3: `Claim will auto-resolve in 1 minute at ${result.claimDeadline}`,
        step4: "You can test the auto-resolution by calling /api/claims/{claimId}/resolve with action: 'auto_resolve'",
        step5: "Or respond as the provider using /api/claims/{claimId}/respond"
      }
    });
  } catch (error) {
    console.error("Error creating test claim scenario:", error);
    return NextResponse.json({ error: "Failed to create test scenario", details: error.message }, { status: 500 });
  }
}