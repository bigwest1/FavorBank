import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ClaimSchema = z.object({
  claimType: z.enum(["NO_SHOW", "UNSAFE_CONDITIONS", "TASK_IMPOSSIBLE", "OTHER"]),
  description: z.string().min(10).max(500)
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
    const body = await request.json();
    const data = ClaimSchema.parse(body);

    // Get the booking with all necessary info
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        slot: {
          include: {
            circle: {
              include: {
                insurance: true
              }
            }
          }
        },
        provider: true,
        booker: true
      }
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Check if user is the booker (only bookers can make claims)
    if (booking.bookerId !== session.user.id) {
      return NextResponse.json({ error: "Only bookers can file claims" }, { status: 403 });
    }

    // Check if booking uses guaranteed credits
    if (!booking.isGuaranteed) {
      return NextResponse.json({ 
        error: "Claims can only be made for guaranteed credit bookings" 
      }, { status: 400 });
    }

    // Check if booking is in valid state for claims
    if (!["CONFIRMED", "IN_PROGRESS"].includes(booking.status)) {
      return NextResponse.json({ 
        error: "Claims can only be made for confirmed or in-progress bookings" 
      }, { status: 400 });
    }

    // Check if there's already a claim for this booking
    const existingClaim = await prisma.insuranceClaim.findFirst({
      where: { bookingId: params.id }
    });

    if (existingClaim) {
      return NextResponse.json({ 
        error: "A claim has already been filed for this booking" 
      }, { status: 400 });
    }

    // Check if circle has insurance pool
    if (!booking.slot.circle.insurance) {
      return NextResponse.json({ 
        error: "This circle does not have insurance coverage" 
      }, { status: 400 });
    }

    // Calculate claim amounts
    const amount = booking.totalCredits || 0;
    const bonusAmount = Math.round(amount * 0.2); // 20% bonus
    const totalPayout = amount + bonusAmount;

    // Set claim deadline (24-48 hours from now)
    const claimDeadline = new Date();
    claimDeadline.setHours(claimDeadline.getHours() + 48); // 48 hour window

    // Create the claim in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the insurance claim
      const claim = await tx.insuranceClaim.create({
        data: {
          poolId: booking.slot.circle.insurance!.id,
          bookingId: params.id,
          claimantId: session.user!.id,
          respondentId: booking.providerId,
          claimType: data.claimType,
          description: data.description,
          amount,
          bonusAmount,
          totalPayout,
          claimDeadline
        }
      });

      // Update booking status to cancelled
      await tx.booking.update({
        where: { id: params.id },
        data: { status: "CANCELLED" }
      });

      return claim;
    });

    // Get the full claim with relations
    const fullClaim = await prisma.insuranceClaim.findUnique({
      where: { id: result.id },
      include: {
        claimant: {
          select: { id: true, name: true, email: true }
        },
        respondent: {
          select: { id: true, name: true, email: true }
        },
        booking: {
          include: {
            slot: {
              select: { title: true, start: true }
            }
          }
        }
      }
    });

    return NextResponse.json({
      claim: fullClaim,
      success: true,
      message: `Claim filed successfully. ${booking.provider.name} has 48 hours to respond, or you'll receive an automatic refund plus 20% bonus.`
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid claim data", 
        details: error.errors 
      }, { status: 400 });
    }
    console.error("Error creating claim:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get any claim for this booking
    const claim = await prisma.insuranceClaim.findFirst({
      where: { bookingId: params.id },
      include: {
        claimant: {
          select: { id: true, name: true }
        },
        respondent: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json(claim);
  } catch (error) {
    console.error("Error fetching claim:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}