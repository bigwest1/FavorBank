import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-10-28.acacia",
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const circleId = params.id;
    const body = await request.json();
    const { amountCents, notes } = body;
    
    if (!amountCents || amountCents < 50) { // Minimum $0.50
      return NextResponse.json({ error: "Amount must be at least $0.50" }, { status: 400 });
    }

    // Verify user can manage treasury
    const circle = await prisma.circle.findFirst({
      where: { id: circleId },
      include: { 
        treasury: true,
        owner: { select: { id: true, email: true, name: true } }
      }
    });

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    const canManage = circle.ownerId === session.user.id || 
                      circle.treasury?.adminUserId === session.user.id;

    if (!canManage) {
      return NextResponse.json({ error: "Only treasury admins can add funds" }, { status: 403 });
    }

    // Ensure treasury exists
    if (!circle.treasury) {
      await prisma.circleTreasury.create({
        data: {
          circleId: circleId,
          adminUserId: session.user.id
        }
      });
    }

    const treasury = circle.treasury || await prisma.circleTreasury.findUnique({ 
      where: { circleId: circleId } 
    });

    // Calculate credits based on conversion rate (default: $1 = 100 credits)
    const conversionRate = 1.0; // 1 cent = 1 credit
    const creditAmount = Math.floor(amountCents / conversionRate);

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: "treasury_funding",
        circleId: circleId,
        treasuryId: treasury!.id,
        creditAmount: creditAmount.toString(),
        fundedByUserId: session.user.id
      },
      description: `Treasury funding for ${circle.name} - ${creditAmount} credits`
    });

    // Create funding transaction record
    const fundingTransaction = await prisma.treasuryFunding.create({
      data: {
        treasuryId: treasury!.id,
        amountCents: amountCents,
        creditAmount: creditAmount,
        conversionRate: conversionRate,
        stripePaymentIntentId: paymentIntent.id,
        status: "PENDING",
        fundedByUserId: session.user.id,
        notes: notes || null
      }
    });

    return NextResponse.json({
      fundingTransaction,
      paymentIntent: {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      },
      creditAmount
    });

  } catch (error: any) {
    console.error("Error creating treasury funding:", error);
    return NextResponse.json({ 
      error: "Failed to create funding request",
      details: error.message 
    }, { status: 500 });
  }
}