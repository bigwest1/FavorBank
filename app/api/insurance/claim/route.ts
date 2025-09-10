import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { insurancePayout } from "@/lib/credits/ledger";

const ClaimSchema = z.object({
  bookingId: z.string(),
  amount: z.number().min(1).max(500), // Up to $500 coverage
  description: z.string().min(10).max(1000),
  evidence: z.string().optional() // Optional evidence/photos
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = ClaimSchema.parse(body);

    // Get the booking with insurance
    const booking = await prisma.booking.findFirst({
      where: {
        id: data.bookingId,
        hasInsurance: true,
        OR: [
          { bookerId: session.user.id }, // Booker can claim
          { providerId: session.user.id } // Provider can claim
        ]
      },
      include: {
        slot: true,
        booker: true,
        provider: true,
        insuranceClaims: true
      }
    });

    if (!booking) {
      return NextResponse.json({ 
        error: "Booking not found or not insured" 
      }, { status: 404 });
    }

    // Check if claim already exists for this booking
    const existingClaim = booking.insuranceClaims.find(claim => 
      claim.status === "PENDING" || claim.status === "APPROVED"
    );

    if (existingClaim) {
      return NextResponse.json({ 
        error: "Insurance claim already exists for this booking" 
      }, { status: 400 });
    }

    // Check circle insurance pool balance
    const insurancePool = await prisma.insurancePool.findUnique({
      where: { circleId: booking.circleId }
    });

    if (!insurancePool || insurancePool.balance < data.amount) {
      return NextResponse.json({ 
        error: "Insufficient insurance pool balance" 
      }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create insurance claim
      const claim = await tx.insuranceClaim.create({
        data: {
          bookingId: data.bookingId,
          claimantUserId: session.user!.id,
          respondentUserId: booking.bookerId === session.user.id ? booking.providerId : booking.bookerId,
          type: "OTHER", // Could be expanded to more types
          description: data.description,
          amount: data.amount,
          evidence: data.evidence,
          status: "APPROVED" // Auto-approve for now, could add manual review
        }
      });

      // Process insurance payout
      await insurancePayout(tx, booking.circleId, session.user!.id, data.amount, {
        claimId: claim.id,
        bookingId: data.bookingId,
        claimType: "damage_protection"
      });

      return claim;
    });

    return NextResponse.json({
      success: true,
      claim: result,
      message: `Insurance claim approved. ${data.amount} credits have been added to your account.`
    });

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid input", 
        details: error.errors 
      }, { status: 400 });
    }
    console.error("Error processing insurance claim:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get("bookingId");

    if (bookingId) {
      // Get claims for specific booking
      const claims = await prisma.insuranceClaim.findMany({
        where: {
          bookingId,
          OR: [
            { claimantUserId: session.user.id },
            { respondentUserId: session.user.id }
          ]
        },
        include: {
          claimant: {
            select: { id: true, name: true, email: true }
          },
          respondent: {
            select: { id: true, name: true, email: true }
          },
          booking: {
            select: { 
              id: true, 
              hasInsurance: true,
              slot: {
                select: { 
                  title: true, 
                  category: true 
                }
              }
            }
          }
        }
      });

      return NextResponse.json({ claims });
    } else {
      // Get all user's insurance claims
      const claims = await prisma.insuranceClaim.findMany({
        where: {
          OR: [
            { claimantUserId: session.user.id },
            { respondentUserId: session.user.id }
          ]
        },
        include: {
          claimant: {
            select: { id: true, name: true, email: true }
          },
          respondent: {
            select: { id: true, name: true, email: true }
          },
          booking: {
            select: { 
              id: true, 
              hasInsurance: true,
              slot: {
                select: { 
                  title: true, 
                  category: true 
                }
              }
            }
          }
        },
        orderBy: { createdAt: "desc" }
      });

      return NextResponse.json({ claims });
    }
  } catch (error) {
    console.error("Error fetching insurance claims:", error);
    return NextResponse.json({ 
      error: "Internal server error" 
    }, { status: 500 });
  }
}