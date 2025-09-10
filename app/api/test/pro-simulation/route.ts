import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create a test Pro user
      let proUser = await tx.user.findFirst({
        where: { email: "pro-test@favorbank.test" }
      });

      if (!proUser) {
        proUser = await tx.user.create({
          data: {
            email: "pro-test@favorbank.test",
            name: "Pro Test User",
            passwordHash: "test"
          }
        });
      }

      // 2. Create or update Pro profile
      let proProfile = await tx.proProfile.findUnique({
        where: { userId: proUser.id }
      });

      if (!proProfile) {
        proProfile = await tx.proProfile.create({
          data: {
            userId: proUser.id,
            status: "APPROVED",
            backgroundCheckPassed: true,
            minDurationMinutes: 60,
            stripeAccountId: "acct_test_pro_user_123",
            stripeDetailsSubmitted: true,
            stripeChargesEnabled: true,
            stripePayoutsEnabled: true,
            applicationNotes: "Test Pro user for demonstration"
          }
        });
      } else {
        proProfile = await tx.proProfile.update({
          where: { userId: proUser.id },
          data: {
            status: "APPROVED",
            backgroundCheckPassed: true,
            stripePayoutsEnabled: true
          }
        });
      }

      // 3. Create skill verifications
      const skills = ["Cleaning", "Tutoring", "Tech Support"];
      const skillVerifications = [];
      
      for (const skill of skills) {
        let skillVerification = await tx.skillVerification.findFirst({
          where: { 
            userId: proUser.id, 
            skill: skill
          }
        });

        if (!skillVerification) {
          skillVerification = await tx.skillVerification.create({
            data: {
              userId: proUser.id,
              skill: skill,
              status: "VERIFIED",
              verifiedBy: proUser.id,
              verifiedAt: new Date(),
              notes: "Verified for testing"
            }
          });
        }
        skillVerifications.push(skillVerification);
      }

      // 4. Create test circle and membership
      let testCircle = await tx.circle.findFirst({
        where: { name: "Pro Test Circle" }
      });

      if (!testCircle) {
        testCircle = await tx.circle.create({
          data: {
            name: "Pro Test Circle",
            description: "Test circle for Pro functionality",
            ownerId: proUser.id
          }
        });

        // Create membership
        await tx.membership.create({
          data: {
            userId: proUser.id,
            circleId: testCircle.id,
            role: "OWNER",
            balanceCredits: 1000
          }
        });
      }

      // 5. Create test booker user
      let testBooker = await tx.user.findFirst({
        where: { email: "booker-test@favorbank.test" }
      });

      if (!testBooker) {
        testBooker = await tx.user.create({
          data: {
            email: "booker-test@favorbank.test",
            name: "Test Booker",
            passwordHash: "test"
          }
        });

        // Add to circle
        await tx.membership.create({
          data: {
            userId: testBooker.id,
            circleId: testCircle.id,
            role: "MEMBER",
            balanceCredits: 500
          }
        });
      }

      // 6. Create a test slot
      const slot = await tx.slot.create({
        data: {
          circleId: testCircle.id,
          providerId: proUser.id,
          title: "Pro Tutoring Session",
          description: "Professional tutoring with cash bonus eligible",
          category: "TUTORING",
          start: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          end: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
          pricePerMinute: 3,
          minDuration: 60,
          status: "OPEN"
        }
      });

      // 7. Create a completed booking to simulate Pro bonus
      const booking = await tx.booking.create({
        data: {
          slotId: slot.id,
          providerId: proUser.id,
          bookerId: testBooker.id,
          circleId: testCircle.id,
          status: "COMPLETED",
          duration: 90, // 90 minutes
          totalCredits: 270, // 90 min * 3 credits/min
          startTime: new Date(Date.now() - 90 * 60 * 1000), // 90 minutes ago
          endTime: new Date() // Just completed
        }
      });

      // 8. Create Pro bonus (simulate what happens in booking completion)
      const bonusAmount = Math.round(booking.totalCredits * 0.15); // 15% of 270 = 40.5 -> 41 cents
      const proBonus = await tx.proBonus.create({
        data: {
          userId: proUser.id,
          bookingId: booking.id,
          baseAmount: booking.totalCredits,
          bonusAmount: bonusAmount,
          bonusRate: 0.15,
          accrualDate: new Date()
        }
      });

      // 9. Create a payout (simulate weekly payout processing)
      const payout = await tx.payout.create({
        data: {
          userId: proUser.id,
          status: "COMPLETED",
          totalAmount: bonusAmount,
          bonusCount: 1,
          weekStartDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          weekEndDate: new Date(),
          stripeAccountId: "acct_test_pro_user_123",
          stripeTransferId: "tr_test_payout_123",
          processedAt: new Date()
        }
      });

      // Update bonus to reference payout
      await tx.proBonus.update({
        where: { id: proBonus.id },
        data: { payoutId: payout.id }
      });

      return {
        proUser: proUser.id,
        proProfile: proProfile.id,
        skillVerifications: skillVerifications.map(s => s.id),
        circle: testCircle.id,
        slot: slot.id,
        booking: booking.id,
        proBonus: {
          id: proBonus.id,
          baseAmount: proBonus.baseAmount,
          bonusAmount: proBonus.bonusAmount,
          bonusRate: proBonus.bonusRate
        },
        payout: {
          id: payout.id,
          totalAmount: payout.totalAmount,
          status: payout.status
        }
      };
    });

    return NextResponse.json({
      success: true,
      message: "Pro user simulation created successfully",
      data: result,
      instructions: {
        step1: "Pro user created with approved status and verified skills",
        step2: "Test slot created with Pro badge and cash bonus eligible label",
        step3: "Completed booking created with 15% cash bonus accrual",
        step4: "Payout processed and Pro bonus marked as paid",
        step5: "Visit /pro/dashboard to see the Pro interface",
        step6: "Visit slot discovery to see Pro badges on slots"
      }
    });

  } catch (error: any) {
    console.error("Error creating Pro simulation:", error);
    return NextResponse.json({ 
      error: "Failed to create Pro simulation",
      details: error.message 
    }, { status: 500 });
  }
}