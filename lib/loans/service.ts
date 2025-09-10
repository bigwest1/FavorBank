import { prisma } from "@/lib/prisma";
import { loanIssue, loanRepay } from "@/lib/credits/ledger";

interface LoanEligibilityAssessment {
  isEligible: boolean;
  maxLoanAmount: number;
  membershipAge: number;
  completionRate: number;
  disputeRate: number;
  peerVouchCount: number;
  currentBalance: number;
  meetsAgeRequirement: boolean;
  meetsCompletionRate: boolean;
  meetsDisputeRate: boolean;
  meetsPeerVouchReq: boolean;
  hasLowBalance: boolean;
  reasons?: string[];
}

export class LoanService {
  private static readonly MAX_LOAN_AMOUNT = 200;
  private static readonly FEE_RATE = 0.10; // 10%
  private static readonly REPAYMENT_PERIOD_DAYS = 60;
  private static readonly PAYMENT_FREQUENCY_DAYS = 7; // Weekly
  
  // Eligibility requirements
  private static readonly MIN_MEMBERSHIP_AGE_DAYS = 30;
  private static readonly MIN_COMPLETION_RATE = 0.80; // 80%
  private static readonly MAX_DISPUTE_RATE = 0.05; // 5%
  private static readonly MIN_PEER_VOUCHES = 2;
  private static readonly LOW_BALANCE_THRESHOLD = 20;

  /**
   * Assess user eligibility for a FavorLoan
   */
  static async assessEligibility(userId: string, circleId: string): Promise<LoanEligibilityAssessment> {
    // Get membership info
    const membership = await prisma.membership.findUnique({
      where: { userId_circleId: { userId, circleId } },
      include: { user: true }
    });

    if (!membership) {
      return {
        isEligible: false,
        maxLoanAmount: 0,
        membershipAge: 0,
        completionRate: 0,
        disputeRate: 0,
        peerVouchCount: 0,
        currentBalance: 0,
        meetsAgeRequirement: false,
        meetsCompletionRate: false,
        meetsDisputeRate: false,
        meetsPeerVouchReq: false,
        hasLowBalance: false,
        reasons: ["User is not a member of this circle"]
      };
    }

    // Calculate membership age
    const now = new Date();
    const membershipAge = Math.floor((now.getTime() - membership.joinedAt.getTime()) / (1000 * 60 * 60 * 24));

    // Get booking statistics
    const totalBookings = await prisma.booking.count({
      where: {
        OR: [
          { bookerId: userId, circleId },
          { providerId: userId, circleId }
        ]
      }
    });

    const completedBookings = await prisma.booking.count({
      where: {
        OR: [
          { bookerId: userId, circleId },
          { providerId: userId, circleId }
        ],
        status: "COMPLETED"
      }
    });

    // Get dispute/claim statistics
    const disputedBookings = await prisma.insuranceClaim.count({
      where: {
        booking: {
          OR: [
            { bookerId: userId, circleId },
            { providerId: userId, circleId }
          ]
        }
      }
    });

    // Get peer vouches (endorsements)
    const peerVouchCount = await prisma.endorsement.count({
      where: { endorsedId: userId }
    });

    // Calculate rates
    const completionRate = totalBookings > 0 ? completedBookings / totalBookings : 0;
    const disputeRate = totalBookings > 0 ? disputedBookings / totalBookings : 0;
    const currentBalance = membership.balanceCredits;

    // Check eligibility criteria
    const meetsAgeRequirement = membershipAge >= this.MIN_MEMBERSHIP_AGE_DAYS;
    const meetsCompletionRate = totalBookings === 0 || completionRate >= this.MIN_COMPLETION_RATE; // New users get benefit of doubt
    const meetsDisputeRate = disputeRate <= this.MAX_DISPUTE_RATE;
    const meetsPeerVouchReq = peerVouchCount >= this.MIN_PEER_VOUCHES;
    const hasLowBalance = currentBalance < this.LOW_BALANCE_THRESHOLD;

    // Check for existing active loans
    const existingLoan = await prisma.loan.findFirst({
      where: {
        borrowerId: userId,
        circleId,
        status: "ACTIVE"
      }
    });

    const reasons: string[] = [];
    if (!meetsAgeRequirement) reasons.push(`Membership must be at least ${this.MIN_MEMBERSHIP_AGE_DAYS} days old`);
    if (!meetsCompletionRate) reasons.push(`Completion rate must be at least ${this.MIN_COMPLETION_RATE * 100}%`);
    if (!meetsDisputeRate) reasons.push(`Dispute rate must be below ${this.MAX_DISPUTE_RATE * 100}%`);
    if (!meetsPeerVouchReq) reasons.push(`Need at least ${this.MIN_PEER_VOUCHES} peer endorsements`);
    if (!hasLowBalance) reasons.push(`Balance must be below ${this.LOW_BALANCE_THRESHOLD} credits to qualify`);
    if (existingLoan) reasons.push("Already have an active loan in this circle");

    const isEligible = meetsAgeRequirement && meetsCompletionRate && meetsDisputeRate && 
                      meetsPeerVouchReq && hasLowBalance && !existingLoan;

    // Calculate max loan amount based on behavioral factors
    let maxLoanAmount = 0;
    if (isEligible) {
      // Base amount: 100 credits
      maxLoanAmount = 100;
      
      // Bonuses based on performance
      if (completionRate >= 0.95) maxLoanAmount += 50; // Excellent completion rate
      if (disputeRate === 0) maxLoanAmount += 25; // No disputes
      if (peerVouchCount >= 5) maxLoanAmount += 25; // Highly vouched
      
      // Cap at maximum
      maxLoanAmount = Math.min(maxLoanAmount, this.MAX_LOAN_AMOUNT);
    }

    return {
      isEligible,
      maxLoanAmount,
      membershipAge,
      completionRate,
      disputeRate,
      peerVouchCount,
      currentBalance,
      meetsAgeRequirement,
      meetsCompletionRate,
      meetsDisputeRate,
      meetsPeerVouchReq,
      hasLowBalance,
      reasons: reasons.length > 0 ? reasons : undefined
    };
  }

  /**
   * Store or update loan eligibility assessment
   */
  static async updateEligibility(userId: string, circleId: string) {
    const assessment = await this.assessEligibility(userId, circleId);
    
    const nextAssessmentAt = new Date();
    nextAssessmentAt.setDate(nextAssessmentAt.getDate() + 30); // Re-assess in 30 days

    return await prisma.loanEligibility.upsert({
      where: { userId_circleId: { userId, circleId } },
      update: {
        isEligible: assessment.isEligible,
        maxLoanAmount: assessment.maxLoanAmount,
        membershipAge: assessment.membershipAge,
        completionRate: assessment.completionRate,
        disputeRate: assessment.disputeRate,
        peerVouchCount: assessment.peerVouchCount,
        currentBalance: assessment.currentBalance,
        meetsAgeRequirement: assessment.meetsAgeRequirement,
        meetsCompletionRate: assessment.meetsCompletionRate,
        meetsDisputeRate: assessment.meetsDisputeRate,
        meetsPeerVouchReq: assessment.meetsPeerVouchReq,
        hasLowBalance: assessment.hasLowBalance,
        assessedAt: new Date(),
        nextAssessmentAt
      },
      create: {
        userId,
        circleId,
        isEligible: assessment.isEligible,
        maxLoanAmount: assessment.maxLoanAmount,
        membershipAge: assessment.membershipAge,
        completionRate: assessment.completionRate,
        disputeRate: assessment.disputeRate,
        peerVouchCount: assessment.peerVouchCount,
        currentBalance: assessment.currentBalance,
        meetsAgeRequirement: assessment.meetsAgeRequirement,
        meetsCompletionRate: assessment.meetsCompletionRate,
        meetsDisputeRate: assessment.meetsDisputeRate,
        meetsPeerVouchReq: assessment.meetsPeerVouchReq,
        hasLowBalance: assessment.hasLowBalance,
        nextAssessmentAt
      }
    });
  }

  /**
   * Issue a FavorLoan to an eligible user
   */
  static async issueLoan(userId: string, circleId: string, requestedAmount: number): Promise<any> {
    // Validate eligibility first
    const assessment = await this.assessEligibility(userId, circleId);
    if (!assessment.isEligible) {
      throw new Error(`User is not eligible for a loan: ${assessment.reasons?.join(", ")}`);
    }

    if (requestedAmount > assessment.maxLoanAmount) {
      throw new Error(`Requested amount (${requestedAmount}) exceeds maximum allowed (${assessment.maxLoanAmount})`);
    }

    const principal = requestedAmount;
    const feeAmount = Math.floor(principal * this.FEE_RATE);
    const totalAmount = principal + feeAmount;
    
    // Calculate weekly payment (60 days = ~8.57 weeks)
    const numberOfPayments = Math.ceil(this.REPAYMENT_PERIOD_DAYS / this.PAYMENT_FREQUENCY_DAYS);
    const weeklyPayment = Math.ceil(totalAmount / numberOfPayments);

    // Set first payment date
    const nextPaymentDue = new Date();
    nextPaymentDue.setDate(nextPaymentDue.getDate() + this.PAYMENT_FREQUENCY_DAYS);

    return await prisma.$transaction(async (tx) => {
      // Create loan record
      const loan = await tx.loan.create({
        data: {
          circleId,
          borrowerId: userId,
          principal,
          remaining: totalAmount, // They owe the total amount (principal + fee)
          feeAmount,
          totalAmount,
          weeklyPayment,
          nextPaymentDue,
          paymentsRemaining: numberOfPayments,
          
          // Store behavioral data at time of loan
          membershipAgeAtLoan: assessment.membershipAge,
          completionRateAtLoan: assessment.completionRate,
          disputeRateAtLoan: assessment.disputeRate,
          peerVouchCountAtLoan: assessment.peerVouchCount
        }
      });

      // Issue credits using ledger system (only the principal amount)
      await loanIssue(tx, circleId, userId, principal, loan.id, {
        kind: "loan_issue",
        loanId: loan.id,
        principal,
        feeAmount,
        totalAmount,
        weeklyPayment
      });

      // Schedule repayments
      const repayments = [];
      for (let i = 0; i < numberOfPayments; i++) {
        const scheduledDate = new Date(nextPaymentDue);
        scheduledDate.setDate(scheduledDate.getDate() + (i * this.PAYMENT_FREQUENCY_DAYS));
        
        repayments.push({
          loanId: loan.id,
          amount: i === numberOfPayments - 1 ? 
                  totalAmount - (weeklyPayment * (numberOfPayments - 1)) : // Last payment gets remainder
                  weeklyPayment,
          scheduledDate
        });
      }

      await tx.loanRepayment.createMany({
        data: repayments
      });

      // Update eligibility to reflect new loan
      await this.updateEligibility(userId, circleId);

      return loan;
    });
  }

  /**
   * Process a loan repayment (automatic or manual)
   */
  static async processRepayment(loanId: string, amount?: number, isAutomatic = true): Promise<any> {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        repayments: {
          where: { actualDate: null },
          orderBy: { scheduledDate: "asc" },
          take: 1
        }
      }
    });

    if (!loan) {
      throw new Error("Loan not found");
    }

    if (loan.status !== "ACTIVE") {
      throw new Error(`Cannot process repayment for ${loan.status} loan`);
    }

    const nextRepayment = loan.repayments[0];
    if (!nextRepayment) {
      throw new Error("No pending repayments found");
    }

    const repaymentAmount = amount || nextRepayment.amount;

    // Check if user has sufficient balance
    const membership = await prisma.membership.findUnique({
      where: { userId_circleId: { userId: loan.borrowerId, circleId: loan.circleId } }
    });

    if (!membership || membership.balanceCredits < repaymentAmount) {
      // Mark loan as defaulted if automatic payment fails
      if (isAutomatic) {
        await prisma.loan.update({
          where: { id: loanId },
          data: {
            status: "DEFAULTED",
            defaultedAt: new Date()
          }
        });
        throw new Error("Insufficient balance for automatic repayment - loan marked as defaulted");
      }
      throw new Error("Insufficient balance for repayment");
    }

    return await prisma.$transaction(async (tx) => {
      // Process repayment via ledger
      await loanRepay(tx, loan.circleId, loan.borrowerId, repaymentAmount, loanId, {
        kind: "loan_repay",
        loanId,
        repaymentId: nextRepayment.id,
        isAutomatic
      });

      // Mark repayment as made
      await tx.loanRepayment.update({
        where: { id: nextRepayment.id },
        data: { actualDate: new Date() }
      });

      // Update loan
      const newRemaining = loan.remaining - repaymentAmount;
      const newPaymentsRemaining = loan.paymentsRemaining - 1;
      
      let updateData: any = {
        remaining: newRemaining,
        paymentsRemaining: newPaymentsRemaining
      };

      if (newRemaining <= 0 || newPaymentsRemaining <= 0) {
        // Loan completed
        updateData.status = "COMPLETED";
        updateData.completedAt = new Date();
      } else {
        // Set next payment due date
        const nextPaymentDue = new Date();
        nextPaymentDue.setDate(nextPaymentDue.getDate() + this.PAYMENT_FREQUENCY_DAYS);
        updateData.nextPaymentDue = nextPaymentDue;
      }

      const updatedLoan = await tx.loan.update({
        where: { id: loanId },
        data: updateData
      });

      return { loan: updatedLoan, repaymentAmount, repaymentId: nextRepayment.id };
    });
  }

  /**
   * Get users who need "jump-start" cards (low balance + eligible)
   */
  static async getUsersNeedingJumpStart(circleId: string) {
    return await prisma.loanEligibility.findMany({
      where: {
        circleId,
        hasLowBalance: true,
        isEligible: true
      },
      include: {
        user: true
      }
    });
  }

  /**
   * Process overdue loans (should be called by cron)
   */
  static async processOverdueLoans(): Promise<number> {
    const now = new Date();
    
    const overdueLoans = await prisma.loan.findMany({
      where: {
        status: "ACTIVE",
        nextPaymentDue: { lt: now }
      }
    });

    let processedCount = 0;
    
    for (const loan of overdueLoans) {
      try {
        await this.processRepayment(loan.id, undefined, true);
        processedCount++;
      } catch (error) {
        console.error(`Failed to process repayment for loan ${loan.id}:`, error);
      }
    }

    return processedCount;
  }

  /**
   * Get loan details with remaining balance
   */
  static async getLoanDetails(loanId: string) {
    return await prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        borrower: {
          select: { id: true, name: true, email: true }
        },
        repayments: {
          orderBy: { scheduledDate: "asc" }
        }
      }
    });
  }

  /**
   * Get user's loan history
   */
  static async getUserLoans(userId: string, circleId?: string) {
    return await prisma.loan.findMany({
      where: {
        borrowerId: userId,
        ...(circleId && { circleId })
      },
      include: {
        circle: {
          select: { id: true, name: true }
        },
        repayments: true
      },
      orderBy: { createdAt: "desc" }
    });
  }
}