import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { prisma } from '@/lib/prisma'
import type Stripe from 'stripe'
import { deposit } from '@/lib/credits/ledger'

async function creditLotsForPack(data: { userId: string; circleId: string; tier: 'BASIC'|'PRIORITY'|'GUARANTEED'; units: number; source: 'stripe' }) {
  // Create a CreditLot and bump balance via ledger deposit
  const { userId, circleId, tier, units } = data
  await prisma.$transaction(async (tx) => {
    await tx.creditLot.create({
      data: {
        userId,
        circleId,
        amount: units,
        remaining: units,
        source: 'PURCHASED',
        tier,
      },
    })
    await tx.ledgerEntry.createMany({
      data: [
        {
          circleId,
          amount: units,
          type: 'DEBIT',
          fromUserId: null,
          toUserId: null,
          meta: { kind: 'PURCHASE_PACK', tier, units, source: 'stripe' },
        },
        {
          circleId,
          amount: units,
          type: 'CREDIT',
          fromUserId: null,
          toUserId: userId,
          meta: { kind: 'PURCHASE_PACK', tier, units, source: 'stripe' },
        },
      ],
    })
    await tx.membership.upsert({ where: { userId_circleId: { userId, circleId } }, update: { balanceCredits: { increment: units } }, create: { userId, circleId, role: 'MEMBER', balanceCredits: units } })
  })
}

async function plusMonthlyCredit(userId: string, circleId: string, units = 100) {
  await prisma.$transaction(async (tx) => {
    await tx.creditLot.create({
      data: { userId, circleId, amount: units, remaining: units, source: 'BONUS', tier: 'BASIC' },
    })
    await tx.ledgerEntry.createMany({
      data: [
        { circleId, amount: units, type: 'DEBIT', fromUserId: null, toUserId: null, meta: { kind: 'PLUS_INCLUDED' } },
        { circleId, amount: units, type: 'CREDIT', fromUserId: null, toUserId: userId, meta: { kind: 'PLUS_INCLUDED' } },
      ],
    })
    await tx.membership.upsert({ where: { userId_circleId: { userId, circleId } }, update: { balanceCredits: { increment: units } }, create: { userId, circleId, role: 'MEMBER', balanceCredits: units } })
  })
}

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const raw = await req.text()
  const sig = (await headers()).get('stripe-signature') as string
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!whSecret) return NextResponse.json({ error: 'Missing STRIPE_WEBHOOK_SECRET' }, { status: 500 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, whSecret)
  } catch (err: any) {
    return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const md = session.metadata || {}
        const userId = md.userId as string
        const circleId = md.circleId as string
        if (session.mode === 'payment') {
          const tier = (md.tier as any) as 'BASIC'|'PRIORITY'|'GUARANTEED'
          const units = Number(md.units || 0)
          if (userId && circleId && tier && units > 0) {
            await creditLotsForPack({ userId, circleId, tier, units, source: 'stripe' })
          }
        }
        if (session.mode === 'subscription') {
          const plan = (md.plan as string) || 'PLUS'
          // Store subscription state
          await prisma.subscription.create({
            data: {
              userId,
              status: 'ACTIVE',
              plan,
              stripeCustomerId: session.customer as string | null,
              stripeSubId: session.subscription as string | null,
            },
          })
          // For PLUS, include monthly credits immediately on first invoice paid (or now if paid)
        }
        break
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subId = invoice.subscription as string | null
        if (subId) {
          const sub = await prisma.subscription.findFirst({ where: { stripeSubId: subId } })
          if (sub && sub.plan === 'PLUS') {
            // Attempt to find a circle for the user via latest membership or fallback to metadata on subscription (not stored). Here we choose first membership.
            const member = await prisma.membership.findFirst({ where: { userId: sub.userId }, orderBy: { createdAt: 'asc' } })
            if (member) await plusMonthlyCredit(sub.userId, member.circleId, 100)
          }
        }
        break
      }
      default:
        break
    }
  } catch (e) {
    // swallow to return 200; Stripe will retry on 500s
    console.error('Webhook handling error', e)
  }

  return NextResponse.json({ received: true })
}

export const config = { api: { bodyParser: false } }
