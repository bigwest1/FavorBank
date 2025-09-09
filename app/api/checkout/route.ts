import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { PRICES, SUBSCRIPTION_PRICES, PackSize, Tier, SubPlan } from '@/lib/stripe/config'

const BodyPack = (b: any) => {
  const { userId, circleId, tier, units, successUrl, cancelUrl } = b || {}
  if (!userId || !circleId || !tier || !units) throw new Error('Missing fields')
  if (!['BASIC','PRIORITY','GUARANTEED'].includes(tier)) throw new Error('Invalid tier')
  if (![120,360,960].includes(Number(units))) throw new Error('Invalid units')
  if (!successUrl || !cancelUrl) throw new Error('Missing return URLs')
  return { userId, circleId, tier: tier as Tier, units: Number(units) as PackSize, successUrl, cancelUrl }
}

const BodySub = (b: any) => {
  const { userId, circleId, plan, successUrl, cancelUrl } = b || {}
  if (!userId || !circleId || !plan) throw new Error('Missing fields')
  const allowed: SubPlan[] = ['PLUS','SLOTSHOP_PRO','CIRCLE_TREASURY_99','CIRCLE_TREASURY_199','CIRCLE_TREASURY_499']
  if (!allowed.includes(plan)) throw new Error('Invalid plan')
  if (!successUrl || !cancelUrl) throw new Error('Missing return URLs')
  return { userId, circleId, plan: plan as SubPlan, successUrl, cancelUrl }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const kind = body.kind as 'pack' | 'subscription'
    if (kind === 'pack') {
      const { userId, circleId, tier, units, successUrl, cancelUrl } = BodyPack(body)
      const price = PRICES[tier][units]
      if (!price) throw new Error('Price not configured')
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { userId, circleId, tier, units: String(units), kind: 'pack' },
      })
      return NextResponse.json({ id: session.id, url: session.url })
    }

    if (kind === 'subscription') {
      const { userId, circleId, plan, successUrl, cancelUrl } = BodySub(body)
      const price = SUBSCRIPTION_PRICES[plan]
      if (!price) throw new Error('Plan not configured')
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        line_items: [{ price, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { userId, circleId, plan, kind: 'subscription' },
      })
      return NextResponse.json({ id: session.id, url: session.url })
    }

    return NextResponse.json({ error: 'Invalid kind' }, { status: 400 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? 'Failed to create checkout session' }, { status: 400 })
  }
}

