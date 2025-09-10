import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create test circle owner
      let circleOwner = await tx.user.findFirst({
        where: { email: "treasury-owner@favorbank.test" }
      });

      if (!circleOwner) {
        circleOwner = await tx.user.create({
          data: {
            email: "treasury-owner@favorbank.test",
            name: "Treasury Owner",
            passwordHash: "test"
          }
        });
      }

      // 2. Create test circle with treasury
      let testCircle = await tx.circle.findFirst({
        where: { name: "Treasury Test Circle" }
      });

      if (!testCircle) {
        testCircle = await tx.circle.create({
          data: {
            name: "Treasury Test Circle",
            description: "Test circle for Treasury functionality",
            ownerId: circleOwner.id
          }
        });

        // Create owner membership
        await tx.membership.create({
          data: {
            userId: circleOwner.id,
            circleId: testCircle.id,
            role: "OWNER",
            balanceCredits: 500
          }
        });
      }

      // 3. Create Treasury with settings
      let treasury = await tx.circleTreasury.findUnique({
        where: { circleId: testCircle.id }
      });

      if (!treasury) {
        treasury = await tx.circleTreasury.create({
          data: {
            circleId: testCircle.id,
            currentBalance: 2000, // Start with some balance
            totalFunded: 2000,
            monthlyAllowanceTotal: 300,
            allowancePerMember: 50, // 50 credits per member per month
            isAllowanceActive: true,
            isMatchingActive: true,
            matchRatio: 1.5, // 1.5:1 matching ratio
            maxMatchPerBooking: 100,
            adminUserId: circleOwner.id
          }
        });
      }

      // 4. Create test members
      const memberEmails = [
        "treasury-member1@favorbank.test",
        "treasury-member2@favorbank.test", 
        "treasury-member3@favorbank.test"
      ];

      const members = [];
      for (const email of memberEmails) {
        let member = await tx.user.findFirst({ where: { email } });
        
        if (!member) {
          member = await tx.user.create({
            data: {
              email,
              name: email.split("@")[0].replace("-", " "),
              passwordHash: "test"
            }
          });

          // Add to circle
          await tx.membership.create({
            data: {
              userId: member.id,
              circleId: testCircle.id,
              role: "MEMBER",
              balanceCredits: 100
            }
          });
        }
        members.push(member);
      }

      // 5. Simulate Treasury funding transaction
      const fundingTransaction = await tx.treasuryFunding.create({
        data: {
          treasuryId: treasury.id,
          amountCents: 2000, // $20.00
          creditAmount: 2000, // 2000 credits
          conversionRate: 1.0,
          status: "COMPLETED",
          fundedByUserId: circleOwner.id,
          notes: "Initial treasury funding for testing",
          processedAt: new Date()
        }
      });

      // 6. Create test slots from members
      const slots = [];
      for (let i = 0; i < members.length; i++) {
        const member = members[i];
        const slot = await tx.slot.create({
          data: {
            circleId: testCircle.id,
            providerId: member.id,
            title: `Test Service ${i + 1}`,
            description: `Treasury matching test service by ${member.name}`,
            category: "OTHER",
            start: new Date(Date.now() + (i + 1) * 60 * 60 * 1000), // Staggered times
            end: new Date(Date.now() + (i + 2) * 60 * 60 * 1000),
            pricePerMinute: 2,
            minDuration: 30,
            status: "OPEN"
          }
        });
        slots.push(slot);
      }

      // 7. Create completed bookings to test matching
      const bookings = [];
      for (let i = 0; i < 2; i++) {
        const provider = members[i];
        const booker = members[(i + 1) % members.length];
        const slot = slots[i];
        
        const booking = await tx.booking.create({
          data: {
            slotId: slot.id,
            providerId: provider.id,
            bookerId: booker.id,
            circleId: testCircle.id,
            status: "COMPLETED",
            duration: 60,
            totalCredits: 120, // 60 minutes * 2 credits/min
            startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            endTime: new Date(Date.now() - 1 * 60 * 60 * 1000) // 1 hour ago
          }
        });

        // Simulate credit matching (1.5:1 ratio = 180 credits matched)
        const matchAmount = Math.floor(booking.totalCredits * 1.5); // 180 credits
        
        // Update provider's balance with match
        await tx.membership.updateMany({
          where: {
            userId: provider.id,
            circleId: testCircle.id
          },
          data: {
            balanceCredits: {
              increment: matchAmount
            }
          }
        });

        // Create ledger entry for the match
        await tx.ledgerEntry.create({
          data: {
            circleId: testCircle.id,
            bookingId: booking.id,
            toUserId: provider.id,
            fromUserId: null, // From treasury
            amount: matchAmount,
            type: "CREDIT",
            meta: {
              kind: "TREASURY_MATCH",
              treasuryId: treasury.id,
              baseAmount: booking.totalCredits,
              matchRatio: 1.5,
              maxMatchPerBooking: 100
            }
          }
        });

        // Update treasury balances
        await tx.circleTreasury.update({
          where: { id: treasury.id },
          data: {
            currentBalance: {
              decrement: matchAmount
            },
            totalMatched: {
              increment: matchAmount
            }
          }
        });

        bookings.push({
          bookingId: booking.id,
          providerId: provider.id,
          baseCredits: booking.totalCredits,
          matchedCredits: matchAmount
        });
      }

      // 8. Simulate monthly allowance distribution
      const now = new Date();
      const memberCount = members.length + 1; // Include owner
      const totalAllowanceAmount = treasury.allowancePerMember * memberCount;
      
      const distribution = await tx.allowanceDistribution.create({
        data: {
          treasuryId: treasury.id,
          totalAmount: totalAllowanceAmount,
          memberCount: memberCount,
          creditsPerMember: treasury.allowancePerMember,
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          status: "COMPLETED",
          startedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
          completedAt: new Date()
        }
      });

      // Distribute allowances to all members (including owner)
      const allMemberIds = [circleOwner.id, ...members.map(m => m.id)];
      for (const memberId of allMemberIds) {
        // Add allowance to member balance
        await tx.membership.updateMany({
          where: {
            userId: memberId,
            circleId: testCircle.id
          },
          data: {
            balanceCredits: {
              increment: treasury.allowancePerMember
            }
          }
        });

        // Create ledger entry for allowance
        await tx.ledgerEntry.create({
          data: {
            circleId: testCircle.id,
            toUserId: memberId,
            fromUserId: null,
            amount: treasury.allowancePerMember,
            type: "CREDIT",
            meta: {
              kind: "TREASURY_ALLOWANCE",
              distributionId: distribution.id,
              month: now.getMonth() + 1,
              year: now.getFullYear(),
              treasuryId: treasury.id
            }
          }
        });
      }

      // Update treasury balance after distribution
      await tx.circleTreasury.update({
        where: { id: treasury.id },
        data: {
          currentBalance: {
            decrement: totalAllowanceAmount
          },
          totalDistributed: {
            increment: totalAllowanceAmount
          },
          lastDistribution: new Date()
        }
      });

      return {
        circleOwner: circleOwner.id,
        testCircle: testCircle.id,
        treasury: {
          id: treasury.id,
          currentBalance: treasury.currentBalance - (bookings.reduce((sum, b) => sum + b.matchedCredits, 0)) - totalAllowanceAmount,
          totalMatched: bookings.reduce((sum, b) => sum + b.matchedCredits, 0),
          totalDistributed: totalAllowanceAmount
        },
        fundingTransaction: fundingTransaction.id,
        members: members.map(m => m.id),
        slots: slots.map(s => s.id),
        bookings: bookings,
        allowanceDistribution: {
          id: distribution.id,
          totalAmount: totalAllowanceAmount,
          memberCount: memberCount,
          creditsPerMember: treasury.allowancePerMember
        }
      };
    });

    return NextResponse.json({
      success: true,
      message: "Treasury simulation created successfully",
      data: result,
      instructions: {
        step1: "Circle created with Treasury enabled",
        step2: "Treasury funded with 2000 credits ($20)",
        step3: "Credit matching active (1.5:1 ratio) with completed bookings",
        step4: "Monthly allowances distributed (50 credits per member)",
        step5: "Visit /circles/{circleId}/treasury to see the admin console",
        step6: "Check reports tab for participation and budget analysis"
      }
    });

  } catch (error: any) {
    console.error("Error creating Treasury simulation:", error);
    return NextResponse.json({ 
      error: "Failed to create Treasury simulation",
      details: error.message 
    }, { status: 500 });
  }
}