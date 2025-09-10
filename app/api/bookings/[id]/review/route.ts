import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ReviewSchema = z.object({
  traits: z.array(z.enum([
    "RELIABLE", "CAREFUL", "CHEERFUL", "HELPFUL", "RESPONSIVE", "FRIENDLY"
  ])).min(1).max(3), // Require 1-3 traits
  note: z.string().max(200).optional()
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
    const data = ReviewSchema.parse(body);

    // Get the booking with all necessary info
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

    // Check if user is part of this booking
    if (booking.providerId !== session.user.id && booking.bookerId !== session.user.id) {
      return NextResponse.json({ error: "Not authorized for this booking" }, { status: 403 });
    }

    // Check if booking is completed
    if (booking.status !== "COMPLETED") {
      return NextResponse.json({ 
        error: "Can only review completed bookings" 
      }, { status: 400 });
    }

    // Determine who is being reviewed
    const isProvider = booking.providerId === session.user.id;
    const revieweeId = isProvider ? booking.bookerId : booking.providerId;

    // Check if user has already left a review
    const existingReview = await prisma.review.findUnique({
      where: {
        bookingId_reviewerId: {
          bookingId: params.id,
          reviewerId: session.user.id
        }
      }
    });

    if (existingReview) {
      return NextResponse.json({ 
        error: "You have already reviewed this booking" 
      }, { status: 400 });
    }

    // Create the review
    const review = await prisma.review.create({
      data: {
        bookingId: params.id,
        reviewerId: session.user.id,
        revieweeId,
        circleId: booking.slot.circle.id,
        traits: data.traits,
        note: data.note
      },
      include: {
        reviewer: {
          select: { id: true, name: true }
        },
        reviewee: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json({
      review,
      success: true,
      message: `Thank you for your positive feedback about ${review.reviewee.name}!`
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid review data", 
        details: error.errors 
      }, { status: 400 });
    }
    console.error("Error creating review:", error);
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
    // Get reviews for this booking
    const reviews = await prisma.review.findMany({
      where: { bookingId: params.id },
      include: {
        reviewer: {
          select: { id: true, name: true }
        },
        reviewee: {
          select: { id: true, name: true }
        }
      }
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}