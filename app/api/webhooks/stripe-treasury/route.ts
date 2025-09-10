import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-10-28.acacia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const sig = request.headers.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
    }

    // Handle the payment intent events
    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      if (paymentIntent.metadata.type === "treasury_funding") {
        await handleTreasuryFundingSuccess(paymentIntent);
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      
      if (paymentIntent.metadata.type === "treasury_funding") {
        await handleTreasuryFundingFailure(paymentIntent);
      }
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

async function handleTreasuryFundingSuccess(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { treasuryId, creditAmount, fundedByUserId } = paymentIntent.metadata;

    await prisma.$transaction(async (tx) => {
      // Update funding transaction status
      const funding = await tx.treasuryFunding.update({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: {
          status: "COMPLETED",
          processedAt: new Date()
        }
      });

      // Update treasury balances
      await tx.circleTreasury.update({
        where: { id: treasuryId },
        data: {
          currentBalance: {
            increment: parseInt(creditAmount)
          },
          totalFunded: {
            increment: parseInt(creditAmount)
          }
        }
      });

      // Create ledger entry for treasury funding
      const treasury = await tx.circleTreasury.findUnique({
        where: { id: treasuryId },
        include: { circle: true }
      });

      await tx.ledgerEntry.create({
        data: {
          circleId: treasury!.circleId,
          toUserId: null, // Treasury funding goes to circle, not individual user
          fromUserId: fundedByUserId || null,
          amount: parseInt(creditAmount),
          type: "CREDIT",
          meta: {
            kind: "TREASURY_FUNDING",
            fundingId: funding.id,
            stripePaymentIntentId: paymentIntent.id,
            amountCents: funding.amountCents,
            conversionRate: funding.conversionRate
          }
        }
      });
    });

    console.log(`Treasury funding completed: ${creditAmount} credits added to treasury ${treasuryId}`);

  } catch (error: any) {
    console.error("Error handling treasury funding success:", error);
  }
}

async function handleTreasuryFundingFailure(paymentIntent: Stripe.PaymentIntent) {
  try {
    await prisma.treasuryFunding.update({
      where: { stripePaymentIntentId: paymentIntent.id },
      data: {
        status: "FAILED",
        processedAt: new Date()
      }
    });

    console.log(`Treasury funding failed for payment intent ${paymentIntent.id}`);

  } catch (error: any) {
    console.error("Error handling treasury funding failure:", error);
  }
}