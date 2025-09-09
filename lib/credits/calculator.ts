// Credit calculation based on effort level and other factors
export interface CreditCalculationParams {
  effortLevel: number; // 1-5 scale
  category?: string;
  timeWindowHours?: number;
  hasEquipment?: boolean;
  locationRadius?: number;
}

export function calculateCreditsOffered(params: CreditCalculationParams): number {
  const { effortLevel, category, timeWindowHours, hasEquipment, locationRadius } = params;
  
  // Base credits by effort level
  const baseCredits = {
    1: 5,   // Very light (< 15 min)
    2: 15,  // Light (15-30 min) 
    3: 30,  // Medium (30-60 min)
    4: 50,  // Heavy (1-2 hours)
    5: 80   // Very heavy (2+ hours)
  };

  let credits = baseCredits[effortLevel as keyof typeof baseCredits] || 30;

  // Category multipliers
  const categoryMultipliers: Record<string, number> = {
    'HOUSEHOLD_TASKS': 1.0,
    'YARD_WORK': 1.2,
    'PET_CARE': 1.1,
    'CHILD_CARE': 1.5,
    'ELDER_CARE': 1.8,
    'TRANSPORTATION': 1.3,
    'TECH_SUPPORT': 1.4,
    'HOME_REPAIR': 1.6,
    'MOVING_HELP': 1.7,
    'ERRANDS': 0.9,
    'COOKING': 1.1,
    'TUTORING': 1.3,
    'CREATIVE_PROJECTS': 1.2,
    'EVENT_HELP': 1.4,
    'OTHER': 1.0
  };

  if (category && categoryMultipliers[category]) {
    credits *= categoryMultipliers[category];
  }

  // Urgency bonus (tight time window)
  if (timeWindowHours && timeWindowHours <= 4) {
    credits *= 1.2; // 20% bonus for urgent requests
  }

  // Equipment premium
  if (hasEquipment) {
    credits += 10; // Fixed bonus for equipment needs
  }

  // Travel distance bonus
  if (locationRadius && locationRadius > 10) {
    credits *= 1.1; // 10% bonus for longer travel
  }

  return Math.round(credits);
}

export function getTierBenefits(tier: string) {
  const benefits = {
    BASIC: {
      name: "Basic",
      description: "Standard visibility and priority",
      features: [
        "Standard response time",
        "Normal queue position",
        "Basic support"
      ],
      color: "gray"
    },
    PRIORITY: {
      name: "Priority",
      description: "Better visibility and faster responses",
      features: [
        "Highlighted in feed",
        "Push notifications to members",
        "Higher queue position",
        "Extended search radius"
      ],
      color: "blue"
    },
    GUARANTEED: {
      name: "Guaranteed",
      description: "Maximum visibility with guarantee coverage",
      features: [
        "Top priority in feed",
        "Instant push notifications",
        "Guarantee fund coverage if unfilled",
        "Maximum search radius",
        "Premium support"
      ],
      color: "green"
    }
  };

  return benefits[tier as keyof typeof benefits] || benefits.BASIC;
}