import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { escrowRelease } from "@/lib/credits/ledger";

const CompleteSchema = z.object({
  completionNotes: z.string().max(500).optional(),
  photoBase64: z.string().optional(),
  thanks: z.string().max(200).optional()
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
    const data = CompleteSchema.parse(body);

    // Get the booking
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        slot: {
          include: {
            circle: true
          }
        },
        provider: true,
        booker: true
      }
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Check if user is either the provider or booker
    if (booking.providerId !== session.user.id && booking.bookerId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized for this booking" }, { status: 403 });
    }

    // Check if booking is in progress
    if (booking.status !== "IN_PROGRESS") {
      return NextResponse.json({ 
        error: `Cannot complete booking with status: ${booking.status}` 
      }, { status: 400 });
    }

    const now = new Date();
    const isProvider = booking.providerId === session.user.id;

    // Complete booking in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update booking to completed
      const completedBooking = await tx.booking.update({
        where: { id: params.id },
        data: {
          status: "COMPLETED",
          actualEnd: now,
          completedAt: now,
          completionNotes: data.completionNotes,
          completionPhotoBase64: data.photoBase64,
          ...(isProvider 
            ? { providerThanks: data.thanks }
            : { bookerThanks: data.thanks }
          )
        }
      });

      // Release escrowed credits
      if (booking.totalCredits) {
        await escrowRelease(
          tx, 
          booking.slot.circle.id,
          booking.bookerId,
          booking.providerId,
          booking.totalCredits,
          booking.id,
          {
            kind: "BOOKING_COMPLETION",
            bookingId: booking.id,
            slotId: booking.slotId,
            duration: booking.duration
          }
        );
      }

      return completedBooking;
    });

    // Get the updated booking with all relations
    const fullBooking = await prisma.booking.findUnique({
      where: { id: result.id },
      include: {
        slot: {
          include: {
            circle: true,
            provider: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        provider: {
          select: { id: true, name: true, email: true }
        },
        booker: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json({ 
      booking: fullBooking,
      success: true,
      message: "Booking completed successfully! Credits have been released."
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid completion data", details: error.errors }, { status: 400 });
    }
    console.error("Error completing booking:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}