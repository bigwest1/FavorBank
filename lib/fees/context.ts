interface BookingContext {
  startTime: Date;
  endTime: Date;
  duration: number;
  category: string;
  location?: string;
  requirements?: string;
  isUrgent?: boolean;
  needsEquipment?: boolean;
  isGuaranteed?: boolean;
  crossCircle?: boolean;
  providerId: string;
  bookerId: string;
  circleId: string;
  bookerIsPlus?: boolean; // Plus users get fee waivers
}

interface FeeRule {
  id: string;
  name: string;
  description: string;
  percentage: number;
  icon: string;
  priority: number;
  cap?: number; // Optional cap in credits
}

interface CalculatedFee {
  rule: FeeRule;
  percentage: number;
  amount: number;
  description: string;
}

interface FeeCalculation {
  baseAmount: number;
  appliedFees: CalculatedFee[];
  totalSurchargeAmount: number;
  totalSurchargePercentage: number;
  finalAmount: number;
  capped: boolean;
  capReason?: string;
  plusWaived: boolean;
  plusWaiverReason?: string;
}

/**
 * Dynamic fees engine that calculates context-aware surcharges
 */
export class FeesContext {
  private static readonly MAX_TOTAL_FEE_PERCENTAGE = 25; // 25% maximum total surcharge
  private static readonly PEAK_HOURS = {
    weekday: { start: 17, end: 20 }, // 5 PM - 8 PM weekdays
    weekend: { start: 9, end: 18 }   // 9 AM - 6 PM weekends
  };

  private static readonly FEE_RULES: FeeRule[] = [
    {
      id: "urgent",
      name: "Urgent",
      description: "Service needed within 24 hours",
      percentage: 15,
      icon: "⚡",
      priority: 1,
      cap: 50
    },
    {
      id: "peak_hours",
      name: "Peak Hours",
      description: "High demand time period",
      percentage: 10,
      icon: "📈",
      priority: 2,
      cap: 30
    },
    {
      id: "equipment",
      name: "Equipment",
      description: "Special equipment or supplies required",
      percentage: 8,
      icon: "🔧",
      priority: 3,
      cap: 25
    },
    {
      id: "cross_circle",
      name: "Cross-Circle",
      description: "Service across different circles",
      percentage: 5,
      icon: "🔄",
      priority: 4,
      cap: 20
    },
    {
      id: "guaranteed",
      name: "Guaranteed",
      description: "Service completion guaranteed",
      percentage: 12,
      icon: "✅",
      priority: 5,
      cap: 40
    },
    {
      id: "specialized",
      name: "Specialized",
      description: "Requires specific expertise",
      percentage: 7,
      icon: "🎓",
      priority: 6,
      cap: 30
    },
    {
      id: "weekend",
      name: "Weekend",
      description: "Weekend service premium",
      percentage: 6,
      icon: "📅",
      priority: 7,
      cap: 20
    },
    {
      id: "platform_fee",
      name: "Platform Fee",
      description: "Platform processing fee (waived for Plus users)",
      percentage: 3,
      icon: "💳",
      priority: 8,
      cap: 15
    }
  ];

  /**
   * Calculate dynamic fees based on booking context
   */
  static calculateFees(baseAmount: number, context: BookingContext): FeeCalculation {
    const applicableFees: CalculatedFee[] = [];

    // Check each fee rule
    for (const rule of this.FEE_RULES) {
      if (this.shouldApplyRule(rule.id, context)) {
        const amount = Math.floor(baseAmount * (rule.percentage / 100));
        const cappedAmount = rule.cap ? Math.min(amount, rule.cap) : amount;

        applicableFees.push({
          rule,
          percentage: rule.percentage,
          amount: cappedAmount,
          description: `${rule.name} (+${rule.percentage}%): ${rule.description}`
        });
      }
    }

    // Sort by priority and calculate totals
    applicableFees.sort((a, b) => a.rule.priority - b.rule.priority);

    const totalSurchargeAmount = applicableFees.reduce((sum, fee) => sum + fee.amount, 0);
    const totalSurchargePercentage = totalSurchargeAmount > 0 ? 
      Math.round((totalSurchargeAmount / baseAmount) * 100) : 0;

    // Apply global fee cap
    const maxFeeAmount = Math.floor(baseAmount * (this.MAX_TOTAL_FEE_PERCENTAGE / 100));
    const cappedSurchargeAmount = Math.min(totalSurchargeAmount, maxFeeAmount);
    const capped = totalSurchargeAmount > maxFeeAmount;

    const finalAmount = baseAmount + cappedSurchargeAmount;

    return {
      baseAmount,
      appliedFees: applicableFees,
      totalSurchargeAmount: cappedSurchargeAmount,
      totalSurchargePercentage: Math.round((cappedSurchargeAmount / baseAmount) * 100),
      finalAmount,
      capped,
      capReason: capped ? `Total fees capped at ${this.MAX_TOTAL_FEE_PERCENTAGE}%` : undefined,
      plusWaived: false,
      plusWaiverReason: undefined
    };
  }

  /**
   * Check if a specific fee rule should be applied
   */
  private static shouldApplyRule(ruleId: string, context: BookingContext): boolean {
    const now = new Date();
    const startTime = new Date(context.startTime);
    const dayOfWeek = startTime.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const hour = startTime.getHours();

    switch (ruleId) {
      case "urgent":
        // Apply if booking is within 24 hours or marked as urgent
        const hoursUntilBooking = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        return context.isUrgent === true || hoursUntilBooking < 24;

      case "peak_hours":
        // Apply if booking is during peak hours
        if (isWeekend) {
          return hour >= this.PEAK_HOURS.weekend.start && hour < this.PEAK_HOURS.weekend.end;
        } else {
          return hour >= this.PEAK_HOURS.weekday.start && hour < this.PEAK_HOURS.weekday.end;
        }

      case "equipment":
        // Apply if equipment is needed or mentioned in requirements
        return context.needsEquipment === true || 
               (context.requirements?.toLowerCase().includes("equipment") || 
                context.requirements?.toLowerCase().includes("supplies") ||
                context.requirements?.toLowerCase().includes("tools"));

      case "cross_circle":
        // Apply if explicitly marked or if provider/booker are from different circles
        return context.crossCircle === true;

      case "guaranteed":
        // Apply if service is guaranteed
        return context.isGuaranteed === true;

      case "specialized":
        // Apply for categories that require special skills
        const specializedCategories = ["TECH_SUPPORT", "TUTORING", "ELDERCARE", "CHILDCARE"];
        return specializedCategories.includes(context.category);

      case "weekend":
        // Apply for weekend bookings
        return isWeekend;

      case "platform_fee":
        // Apply platform fee, but waived for Plus users on purchases/exchanges
        // For bookings, apply to everyone (regular bookings keep platform fees)
        // This is a base platform fee - Plus users get it waived on "additional purchases"
        return true; // Apply by default, Plus waiver handled separately

      default:
        return false;
    }
  }

  /**
   * Get human-readable fee summary
   */
  static getFeeSummary(calculation: FeeCalculation): string {
    if (calculation.appliedFees.length === 0) {
      return "No additional fees";
    }

    const feeDescriptions = calculation.appliedFees.map(fee => 
      `${fee.rule.icon} ${fee.rule.name} +${fee.percentage}%`
    ).join(", ");

    const capNote = calculation.capped ? ` (${calculation.capReason})` : "";
    
    return `${feeDescriptions} = +${calculation.totalSurchargePercentage}%${capNote}`;
  }

  /**
   * Get fee breakdown for display
   */
  static getFeeBreakdown(calculation: FeeCalculation) {
    return {
      baseAmount: calculation.baseAmount,
      fees: calculation.appliedFees.map(fee => ({
        id: fee.rule.id,
        name: fee.rule.name,
        icon: fee.rule.icon,
        description: fee.rule.description,
        percentage: fee.percentage,
        amount: fee.amount,
        displayText: `${fee.rule.icon} ${fee.rule.name} +${fee.percentage}%`
      })),
      totalSurcharge: calculation.totalSurchargeAmount,
      totalPercentage: calculation.totalSurchargePercentage,
      finalAmount: calculation.finalAmount,
      capped: calculation.capped,
      capReason: calculation.capReason,
      summary: this.getFeeSummary(calculation)
    };
  }

  /**
   * Calculate fees for credit purchase or exchange
   */
  static calculateTransactionFees(
    amount: number, 
    transactionType: "purchase" | "exchange",
    context?: {
      urgent?: boolean;
      crossCircle?: boolean;
      guaranteed?: boolean;
      userIsPlus?: boolean;
    }
  ): FeeCalculation {
    // Create simplified context for non-booking transactions
    const bookingContext: BookingContext = {
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      category: "OTHER",
      isUrgent: context?.urgent,
      crossCircle: context?.crossCircle,
      isGuaranteed: context?.guaranteed,
      providerId: "",
      bookerId: "",
      circleId: "",
      bookerIsPlus: context?.userIsPlus
    };

    const calculation = this.calculateFees(amount, bookingContext);
    
    // Apply Plus user platform fee waiver for purchases/exchanges
    if (context?.userIsPlus && (transactionType === "purchase" || transactionType === "exchange")) {
      // Remove platform fee for Plus users
      const platformFeeIndex = calculation.appliedFees.findIndex(fee => fee.rule.id === "platform_fee");
      if (platformFeeIndex >= 0) {
        const platformFee = calculation.appliedFees[platformFeeIndex];
        calculation.appliedFees.splice(platformFeeIndex, 1);
        calculation.totalSurchargeAmount -= platformFee.amount;
        calculation.totalSurchargePercentage = Math.round((calculation.totalSurchargeAmount / amount) * 100);
        calculation.finalAmount = amount + calculation.totalSurchargeAmount;
        calculation.plusWaived = true;
        calculation.plusWaiverReason = "Platform fee waived for Plus users";
      }
    }

    return calculation;
  }

  /**
   * Get all available fee rules for reference
   */
  static getAllFeeRules(): FeeRule[] {
    return [...this.FEE_RULES];
  }

  /**
   * Get maximum allowed fee percentage
   */
  static getMaxFeePercentage(): number {
    return this.MAX_TOTAL_FEE_PERCENTAGE;
  }
}