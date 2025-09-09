import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ThanksSchema = z.object({
  message: z.string().min(1).max(200)
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
    const data = ThanksSchema.parse(body);

    // Get the booking
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        provider: {
          select: { id: true, name: true }
        },
        booker: {
          select: { id: true, name: true }
        }
      }
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    // Check if user is either the provider or booker
    if (booking.providerId !== session.user.id && booking.bookerId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized for this booking" }, { status: 403 });
    }

    // Check if booking is completed
    if (booking.status !== "COMPLETED") {
      return NextResponse.json({ 
        error: "Can only leave thanks for completed bookings" 
      }, { status: 400 });
    }

    const isProvider = booking.providerId === session.user.id;

    // Check if user has already left thanks
    const existingThanks = isProvider ? booking.providerThanks : booking.bookerThanks;
    if (existingThanks) {
      return NextResponse.json({ 
        error: "You have already left a thank you message for this booking" 
      }, { status: 400 });
    }

    // Update booking with thanks
    const updatedBooking = await prisma.booking.update({
      where: { id: params.id },
      data: {
        ...(isProvider 
          ? { providerThanks: data.message }
          : { bookerThanks: data.message }
        )
      },
      include: {
        provider: {
          select: { id: true, name: true, email: true }
        },
        booker: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json({
      booking: updatedBooking,
      success: true,
      message: `Thank you message sent to ${isProvider ? booking.booker.name : booking.provider.name}!`
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid thank you message", details: error.errors }, { status: 400 });
    }
    console.error("Error leaving thanks:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}