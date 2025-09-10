import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get completed bookings where user was providing help (giving)
    const providedBookings = await prisma.booking.findMany({
      where: {
        providerId: params.id,
        status: "COMPLETED"
      },
      select: {
        totalCredits: true,
        completedAt: true,
        slot: {
          select: {
            circle: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        request: {
          select: {
            creditsOffered: true
          }
        }
      }
    });

    // Get completed bookings where user was receiving help (getting)
    const receivedBookings = await prisma.booking.findMany({
      where: {
        OR: [
          { bookerId: params.id }, // SlotShop bookings
          { request: { userId: params.id } } // Request-based bookings
        ],
        status: "COMPLETED"
      },
      select: {
        totalCredits: true,
        completedAt: true,
        slot: {
          select: {
            circle: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        request: {
          select: {
            creditsOffered: true,
            circle: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    // Calculate totals
    const totalGiven = providedBookings.reduce((sum, booking) => {
      return sum + (booking.totalCredits || booking.request?.creditsOffered || 0);
    }, 0);

    const totalReceived = receivedBookings.reduce((sum, booking) => {
      return sum + (booking.totalCredits || booking.request?.creditsOffered || 0);
    }, 0);

    // Calculate reciprocity ratio (given / received)
    const reciprocityRatio = totalReceived > 0 ? totalGiven / totalReceived : totalGiven > 0 ? 10 : 1;

    // Sweet spot is between 0.8 and 1.2 (giving 80%-120% of what you receive)
    const isInSweetSpot = reciprocityRatio >= 0.8 && reciprocityRatio <= 1.2;
    
    // Determine if user is over-asking (ratio < 0.5 means receiving more than 2x what they give)
    const isOverAsking = reciprocityRatio < 0.5 && totalReceived > 20; // Only flag if significant usage

    // Get recent activity (last 30 days) for trends
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentProvided = providedBookings.filter(b => 
      b.completedAt && new Date(b.completedAt) > thirtyDaysAgo
    ).length;

    const recentReceived = receivedBookings.filter(b => 
      b.completedAt && new Date(b.completedAt) > thirtyDaysAgo
    ).length;

    // Get breakdown by circle
    const circleBreakdown = new Map();
    
    providedBookings.forEach(booking => {
      const circle = booking.slot?.circle || booking.request?.circle;
      if (circle) {
        const current = circleBreakdown.get(circle.id) || { 
          id: circle.id, 
          name: circle.name, 
          given: 0, 
          received: 0 
        };
        current.given += booking.totalCredits || booking.request?.creditsOffered || 0;
        circleBreakdown.set(circle.id, current);
      }
    });

    receivedBookings.forEach(booking => {
      const circle = booking.slot?.circle || booking.request?.circle;
      if (circle) {
        const current = circleBreakdown.get(circle.id) || { 
          id: circle.id, 
          name: circle.name, 
          given: 0, 
          received: 0 
        };
        current.received += booking.totalCredits || booking.request?.creditsOffered || 0;
        circleBreakdown.set(circle.id, current);
      }
    });

    return NextResponse.json({
      totalGiven,
      totalReceived,
      reciprocityRatio: Math.round(reciprocityRatio * 100) / 100, // Round to 2 decimals
      isInSweetSpot,
      isOverAsking,
      recentActivity: {
        provided: recentProvided,
        received: recentReceived,
        days: 30
      },
      circleBreakdown: Array.from(circleBreakdown.values()),
      totalSessions: providedBookings.length + receivedBookings.length,
      // Generate nudge message if over-asking
      nudgeMessage: isOverAsking ? 
        "Post a micro-slot? 5 minutes is perfect to help others and balance your reciprocity." : null
    });
  } catch (error) {
    console.error("Error fetching reciprocity data:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}