import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const proProfile = await prisma.proProfile.findUnique({
      where: { userId: session.user.id }
    });

    if (!proProfile) {
      return NextResponse.json({ 
        error: "Pro profile not found" 
      }, { status: 404 });
    }

    const skillVerifications = await prisma.skillVerification.findMany({
      where: { userId: session.user.id },
      orderBy: { skill: "asc" }
    });

    // If we have a Stripe account, check its status
    if (proProfile.stripeAccountId) {
      try {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        const account = await stripe.accounts.retrieve(proProfile.stripeAccountId);
        
        // Update profile with latest Stripe status
        await prisma.proProfile.update({
          where: { userId: session.user.id },
          data: {
            stripeDetailsSubmitted: account.details_submitted,
            stripeChargesEnabled: account.charges_enabled,
            stripePayoutsEnabled: account.payouts_enabled
          }
        });

        // Return updated profile
        const updatedProfile = await prisma.proProfile.findUnique({
          where: { userId: session.user.id }
        });

        return NextResponse.json({
          proProfile: updatedProfile,
          skillVerifications,
          stripeAccount: {
            id: account.id,
            detailsSubmitted: account.details_submitted,
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            requirements: account.requirements
          }
        });

      } catch (stripeError) {
        console.error("Error checking Stripe account:", stripeError);
        // Continue with existing profile data
      }
    }

    return NextResponse.json({
      proProfile,
      skillVerifications
    });

  } catch (error: any) {
    console.error("Error checking onboarding status:", error);
    return NextResponse.json({ 
      error: "Failed to check status",
      details: error.message 
    }, { status: 500 });
  }
}