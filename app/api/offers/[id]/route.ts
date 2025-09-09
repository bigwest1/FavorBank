import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { escrowRelease } from "@/lib/credits/ledger";

const AcceptOfferSchema = z.object({
  action: z.enum(["accept", "reject"])
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = AcceptOfferSchema.parse(body);

    // Get the offer with request details
    const offer = await prisma.offer.findUnique({
      where: { id: params.id },
      include: {
        request: {
          include: {
            user: true
          }
        },
        helper: true
      }
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 });
    }

    // Only request owner can accept/reject offers
    if (offer.request.userId !== session.user.id) {
      return NextResponse.json({ error: "Only request owner can accept or reject offers" }, { status: 403 });
    }

    // Can only accept/reject pending offers
    if (offer.status !== "PENDING") {
      return NextResponse.json({ error: "Offer is no longer pending" }, { status: 400 });
    }

    if (data.action === "accept") {
      // Accept the offer and create booking
      const result = await prisma.$transaction(async (tx) => {
        // Update offer status
        const updatedOffer = await tx.offer.update({
          where: { id: params.id },
          data: { status: "ACCEPTED" }
        });

        // Reject all other pending offers for this request
        await tx.offer.updateMany({
          where: {
            requestId: offer.requestId,
            id: { not: params.id },
            status: "PENDING"
          },
          data: { status: "REJECTED" }
        });

        // Create a slot for this booking (simplified approach)
        const slot = await tx.slot.create({
          data: {
            requestId: offer.requestId,
            start: offer.proposedStartAt || new Date(),
            end: offer.proposedStartAt 
              ? new Date(new Date(offer.proposedStartAt).getTime() + (offer.estimatedHours || 1) * 60 * 60 * 1000)
              : new Date(Date.now() + 60 * 60 * 1000), // Default 1 hour
            status: "BOOKED"
          }
        });

        // Create a booking
        const booking = await tx.booking.create({
          data: {
            requestId: offer.requestId,
            slotId: slot.id,
            providerId: offer.helperId,
            status: "CONFIRMED"
          }
        });

        // Update request status to BOOKED
        await tx.request.update({
          where: { id: offer.requestId },
          data: { status: "BOOKED" }
        });

        // Release escrowed credits to the helper
        await escrowRelease(
          tx,
          offer.request.circleId,
          offer.helperId,
          offer.request.creditsOffered,
          booking.id,
          {
            kind: "OFFER_ACCEPTED",
            requestId: offer.requestId,
            offerId: params.id
          }
        );

        return { offer: updatedOffer, booking };
      });

      return NextResponse.json(result);
    } else {
      // Reject the offer
      const updatedOffer = await prisma.offer.update({
        where: { id: params.id },
        data: { status: "REJECTED" },
        include: {
          helper: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          request: {
            select: {
              title: true
            }
          }
        }
      });

      return NextResponse.json(updatedOffer);
    }
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Error updating offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if user owns this offer
    const offer = await prisma.offer.findFirst({
      where: {
        id: params.id,
        helperId: session.user.id,
        status: "PENDING"
      }
    });

    if (!offer) {
      return NextResponse.json({ error: "Offer not found or cannot be withdrawn" }, { status: 404 });
    }

    // Withdraw the offer
    const updatedOffer = await prisma.offer.update({
      where: { id: params.id },
      data: { status: "WITHDRAWN" }
    });

    return NextResponse.json(updatedOffer);
  } catch (error) {
    console.error("Error withdrawing offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}