import Stripe from 'stripe'

let singleton: Stripe | null = null

export function getStripe(): Stripe {
  if (singleton) return singleton
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    // Defer failure to runtime usage in routes that require Stripe.
    // This prevents build-time crashes when env vars are not present.
    throw new Error('Missing STRIPE_SECRET_KEY')
  }
  singleton = new Stripe(key, { apiVersion: '2024-06-20' })
  return singleton
}
