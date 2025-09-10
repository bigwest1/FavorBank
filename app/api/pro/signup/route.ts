import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ProSignupSchema = z.object({
  backgroundCheck: z.boolean(),
  minDurationMinutes: z.number().min(30).max(480),
  applicationNotes: z.string().max(500).optional(),
  selectedSkills: z.array(z.string()).min(1, "At least one skill is required")
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = ProSignupSchema.parse(body);

    if (!data.backgroundCheck) {
      return NextResponse.json({ 
        error: "Background check consent is required for Pro membership" 
      }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Check if user already has a Pro profile
      const existingProfile = await tx.proProfile.findUnique({
        where: { userId: session.user!.id }
      });

      if (existingProfile) {
        return NextResponse.json({ 
          error: "You already have a Pro application submitted" 
        }, { status: 400 });
      }

      // Create Pro profile
      const proProfile = await tx.proProfile.create({
        data: {
          userId: session.user!.id,
          status: "PENDING",
          backgroundCheckPassed: false,
          minDurationMinutes: data.minDurationMinutes,
          applicationNotes: data.applicationNotes || null,
          stripeDetailsSubmitted: false,
          stripeChargesEnabled: false,
          stripePayoutsEnabled: false
        }
      });

      // Create skill verification requests
      const skillVerifications = await Promise.all(
        data.selectedSkills.map(skill => 
          tx.skillVerification.create({
            data: {
              userId: session.user!.id,
              skill,
              status: "PENDING"
            }
          })
        )
      );

      // Create Stripe Connect Express account
      let stripeOnboardingUrl: string | null = null;
      try {
        const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
        
        const account = await stripe.accounts.create({
          type: "express",
          email: session.user!.email,
          capabilities: {
            transfers: { requested: true }
          }
        });

        const accountLink = await stripe.accountLinks.create({
          account: account.id,
          refresh_url: `${request.nextUrl.origin}/pro/onboarding?refresh=true`,
          return_url: `${request.nextUrl.origin}/pro/onboarding/complete`,
          type: "account_onboarding"
        });

        stripeOnboardingUrl = accountLink.url;

        // Update profile with Stripe account info
        await tx.proProfile.update({
          where: { userId: session.user!.id },
          data: {
            stripeAccountId: account.id,
            stripeOnboardingUrl: accountLink.url
          }
        });

      } catch (stripeError) {
        console.error("Stripe account creation failed:", stripeError);
        // Continue with application, Stripe setup can be retried later
      }

      return {
        proProfile,
        skillVerifications,
        stripeOnboardingUrl
      };
    });

    return NextResponse.json({
      success: true,
      message: "Pro application submitted successfully",
      data: {
        profileId: result.proProfile.id,
        skillCount: result.skillVerifications.length,
        stripeOnboardingUrl: result.stripeOnboardingUrl
      },
      stripeOnboardingUrl: result.stripeOnboardingUrl
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid application data", 
        details: error.errors 
      }, { status: 400 });
    }
    console.error("Error creating Pro application:", error);
    return NextResponse.json({ 
      error: "Failed to submit application",
      details: error.message 
    }, { status: 500 });
  }
}