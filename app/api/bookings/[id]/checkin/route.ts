import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CheckinSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
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
    const data = CheckinSchema.parse(body);

    // Get the booking
    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: {
        slot: true,
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

    // Check if booking is in correct state
    if (booking.status !== "CONFIRMED") {
      return NextResponse.json({ 
        error: `Cannot check in to booking with status: ${booking.status}` 
      }, { status: 400 });
    }

    // Check if booking time has started (within 15 minutes early)
    const slotStart = new Date(booking.slot.start);
    const now = new Date();
    const fifteenMinutesEarly = new Date(slotStart.getTime() - 15 * 60 * 1000);
    
    if (now < fifteenMinutesEarly) {
      return NextResponse.json({ 
        error: "Cannot check in more than 15 minutes before start time" 
      }, { status: 400 });
    }

    // For location-based bookings, verify geolocation is within radius
    // This is a simplified check - in production you'd want more sophisticated location verification
    if (booking.slot.requestId) {
      const request = await prisma.request.findUnique({
        where: { id: booking.slot.requestId }
      });
      
      if (request?.locationRadius && request?.city) {
        // In a real implementation, you'd calculate distance from the request location
        // For now, we'll just store the coordinates and trust the client
        console.log(`Geolocation check for booking ${booking.id}: ${data.latitude}, ${data.longitude}`);
      }
    }

    // Update booking to IN_PROGRESS
    const updatedBooking = await prisma.booking.update({
      where: { id: params.id },
      data: {
        status: "IN_PROGRESS",
        actualStart: now,
        checkinLatitude: data.latitude,
        checkinLongitude: data.longitude
      },
      include: {
        slot: true,
        provider: {
          select: { id: true, name: true, email: true }
        },
        booker: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json(updatedBooking);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid geolocation data", details: error.errors }, { status: 400 });
    }
    console.error("Error checking in to booking:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}