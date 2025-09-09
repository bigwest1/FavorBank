export type PackSize = 120 | 360 | 960
export type Tier = 'BASIC' | 'PRIORITY' | 'GUARANTEED'
export type SubPlan = 'PLUS' | 'SLOTSHOP_PRO' | 'CIRCLE_TREASURY_99' | 'CIRCLE_TREASURY_199' | 'CIRCLE_TREASURY_499'

// Map your Stripe Price IDs here. Replace placeholders with real IDs from Stripe.
export const PRICES: Record<Tier, Partial<Record<PackSize, string>>> = {
  BASIC: { 120: 'price_basic_120', 360: 'price_basic_360', 960: 'price_basic_960' },
  PRIORITY: { 120: 'price_priority_120', 360: 'price_priority_360', 960: 'price_priority_960' },
  GUARANTEED: { 120: 'price_guaranteed_120', 360: 'price_guaranteed_360', 960: 'price_guaranteed_960' },
}

export const SUBSCRIPTION_PRICES: Record<SubPlan, string> = {
  PLUS: 'price_plus_100',
  SLOTSHOP_PRO: 'price_slotshop_pro_29',
  CIRCLE_TREASURY_99: 'price_treasury_99',
  CIRCLE_TREASURY_199: 'price_treasury_199',
  CIRCLE_TREASURY_499: 'price_treasury_499',
}

