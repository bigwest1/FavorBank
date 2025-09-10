import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { LoanService } from "@/lib/loans/service";

export async function POST(request: NextRequest) {
  try {
    const { action, userId, circleId, amount, loanId, ...options } = await request.json();

    switch (action) {
      case "assess_eligibility":
        // Assess loan eligibility for a user
        const assessment = await LoanService.assessEligibility(userId, circleId);
        
        return NextResponse.json({
          success: true,
          assessment
        });

      case "create_mock_history":
        // Create mock booking/endorsement history for testing eligibility
        const bookingCount = options.bookingCount || 10;
        const completionRate = options.completionRate || 0.90;
        const disputeRate = options.disputeRate || 0.02;
        const endorsementCount = options.endorsementCount || 3;
        
        // First, ensure user and membership exist
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

        // Set membership to be older than 30 days for eligibility
        const membershipDate = new Date();
        membershipDate.setDate(membershipDate.getDate() - 35); // 35 days ago

        await prisma.membership.upsert({
          where: { userId_circleId: { userId, circleId } },
          update: { balanceCredits: 15 }, // Low balance to trigger eligibility
          create: {
            userId,
            circleId,
            role: "MEMBER",
            balanceCredits: 15, // Low balance to trigger eligibility
            joinedAt: membershipDate,
            isActive: true
          }
        });
        
        // Create mock bookings
        const completedBookings = Math.floor(bookingCount * completionRate);
        const disputedBookings = Math.floor(bookingCount * disputeRate);
        
        // Create mock endorsers first
        for (let i = 0; i < endorsementCount; i++) {
          await prisma.user.upsert({
            where: { id: `mock-endorser-${i}` },
            update: {},
            create: {
              id: `mock-endorser-${i}`,
              email: `endorser${i}@test.com`,
              name: `Mock Endorser ${i}`,
              isActive: true
            }
          });
        }
        
        // Create mock endorsements
        for (let i = 0; i < endorsementCount; i++) {
          await prisma.endorsement.upsert({
            where: { 
              endorserId_endorsedId_trait: { 
                endorserId: `mock-endorser-${i}`,
                endorsedId: userId,
                trait: "RELIABLE"
              }
            },
            update: {},
            create: {
              endorserId: `mock-endorser-${i}`,
              endorsedId: userId,
              trait: "RELIABLE",
              strength: 3, // Strong endorsement
              context: `Test endorsement ${i + 1} for loan eligibility`
            }
          });
        }
        
        // Mock booking stats by creating completed/disputed bookings
        for (let i = 0; i < completedBookings; i++) {
          await prisma.booking.create({
            data: {
              slotId: "mock-slot",
              providerId: userId,
              bookerId: `mock-booker-${i}`,
              circleId,
              status: "COMPLETED",
              duration: 60,
              totalCredits: 10,
              startTime: new Date(),
              endTime: new Date()
            }
          });
        }
        
        for (let i = 0; i < disputedBookings; i++) {
          const booking = await prisma.booking.create({
            data: {
              slotId: "mock-slot",
              providerId: userId,
              bookerId: `mock-disputer-${i}`,
              circleId,
              status: "DISPUTED",
              duration: 60,
              totalCredits: 10,
              startTime: new Date(),
              endTime: new Date()
            }
          });
          
          // Create a mock insurance claim for this booking
          await prisma.insuranceClaim.create({
            data: {
              bookingId: booking.id,
              claimantUserId: `mock-disputer-${i}`,
              respondentUserId: userId,
              type: "OTHER",
              description: "Mock dispute for testing",
              amount: 10,
              status: "RESOLVED"
            }
          });
        }
        
        return NextResponse.json({
          success: true,
          message: "Mock history created",
          stats: {
            bookingCount,
            completedBookings,
            disputedBookings,
            endorsementCount,
            completionRate,
            disputeRate
          }
        });

      case "issue_loan":
        // Issue a loan to an eligible user
        try {
          const loan = await LoanService.issueLoan(userId, circleId, amount);
          
          return NextResponse.json({
            success: true,
            message: "Loan issued successfully",
            loan
          });
        } catch (error: any) {
          return NextResponse.json({
            success: false,
            message: error.message
          }, { status: 400 });
        }

      case "process_repayment":
        // Process a loan repayment (automatic or manual)
        try {
          const result = await LoanService.processRepayment(
            loanId, 
            amount, 
            options.isAutomatic !== false
          );
          
          return NextResponse.json({
            success: true,
            message: "Repayment processed successfully",
            result
          });
        } catch (error: any) {
          return NextResponse.json({
            success: false,
            message: error.message
          }, { status: 400 });
        }

      case "get_loan_details":
        // Get loan details with remaining balance
        const loanDetails = await LoanService.getLoanDetails(loanId);
        
        if (!loanDetails) {
          return NextResponse.json({
            success: false,
            message: "Loan not found"
          }, { status: 404 });
        }
        
        return NextResponse.json({
          success: true,
          loan: loanDetails
        });

      case "get_user_loans":
        // Get user's loan history
        const userLoans = await LoanService.getUserLoans(userId, circleId);
        
        return NextResponse.json({
          success: true,
          loans: userLoans
        });

      case "update_eligibility":
        // Update eligibility assessment
        const eligibility = await LoanService.updateEligibility(userId, circleId);
        
        return NextResponse.json({
          success: true,
          eligibility
        });

      case "simulate_overdue_payments":
        // Simulate processing overdue loans (cron job simulation)
        const processedCount = await LoanService.processOverdueLoans();
        
        return NextResponse.json({
          success: true,
          message: `Processed ${processedCount} overdue loan payments`,
          processedCount
        });

      case "get_jump_start_users":
        // Get users who need jump-start cards
        const jumpStartUsers = await LoanService.getUsersNeedingJumpStart(circleId);
        
        return NextResponse.json({
          success: true,
          users: jumpStartUsers
        });

      case "set_low_balance":
        // Set user balance low to trigger jump-start eligibility
        const targetBalance = options.balance || 15; // Below 20 threshold
        
        await prisma.membership.update({
          where: { userId_circleId: { userId, circleId } },
          data: { balanceCredits: targetBalance }
        });
        
        // Update eligibility to reflect low balance
        await LoanService.updateEligibility(userId, circleId);
        
        return NextResponse.json({
          success: true,
          message: `Set user balance to ${targetBalance} credits`,
          balance: targetBalance
        });

      case "advance_loan_date":
        // Advance loan's next payment date for testing overdue logic
        if (!loanId) {
          return NextResponse.json({
            success: false,
            message: "loanId required"
          }, { status: 400 });
        }
        
        const daysBack = options.daysBack || 8; // Make it overdue by default
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - daysBack);
        
        const updatedLoan = await prisma.loan.update({
          where: { id: loanId },
          data: { nextPaymentDue: pastDate }
        });
        
        return NextResponse.json({
          success: true,
          message: `Advanced loan payment date by ${daysBack} days`,
          loan: updatedLoan
        });

      default:
        return NextResponse.json({
          error: "Invalid action",
          availableActions: [
            "assess_eligibility",
            "create_mock_history", 
            "issue_loan",
            "process_repayment",
            "get_loan_details",
            "get_user_loans",
            "update_eligibility",
            "simulate_overdue_payments",
            "get_jump_start_users",
            "set_low_balance",
            "advance_loan_date"
          ]
        }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Error in loan simulation:", error);
    return NextResponse.json({
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}