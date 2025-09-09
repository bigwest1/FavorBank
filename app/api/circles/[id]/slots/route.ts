import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateSlotSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().max(500).optional(),
  category: z.string(),
  start: z.string().datetime(),
  end: z.string().datetime(),
  pricePerMinute: z.number().min(1).max(50),
  minDuration: z.number().min(5).max(240),
  maxDuration: z.number().min(15).max(480).optional(),
  location: z.string().max(200).optional()
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if user is a member of this circle
    const membership = await prisma.membership.findFirst({
      where: {
        circleId: params.id,
        userId: session.user.id
      }
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this circle" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const priceRange = searchParams.get("priceRange");
    const timeFilter = searchParams.get("timeFilter");

    // Build filters
    const filters: any = {
      circleId: params.id,
      status: "OPEN",
      requestId: null, // Only standalone slots
      start: {
        gte: new Date() // Only future slots
      }
    };

    if (category) {
      filters.category = category;
    }

    if (priceRange) {
      const [min, max] = priceRange.split('-');
      if (max === '+') {
        filters.pricePerMinute = { gte: parseInt(min) };
      } else {
        filters.pricePerMinute = { 
          gte: parseInt(min), 
          lte: parseInt(max) 
        };
      }
    }

    if (timeFilter) {
      const now = new Date();
      let startTime = now;
      let endTime: Date;

      switch (timeFilter) {
        case 'today':
          endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case 'tomorrow':
          startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          endTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2);
          break;
        case 'this-week':
          const daysUntilSunday = 7 - now.getDay();
          endTime = new Date(now.getTime() + daysUntilSunday * 24 * 60 * 60 * 1000);
          break;
        case 'next-week':
          const nextWeekStart = new Date(now.getTime() + (7 - now.getDay()) * 24 * 60 * 60 * 1000);
          const nextWeekEnd = new Date(nextWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          startTime = nextWeekStart;
          endTime = nextWeekEnd;
          break;
        default:
          endTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
      }

      filters.start = {
        gte: startTime,
        lte: endTime
      };
    }

    const slots = await prisma.slot.findMany({
      where: filters,
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            city: true
          }
        },
        _count: {
          select: {
            bookings: {
              where: {
                status: {
                  in: ["PENDING", "CONFIRMED"]
                }
              }
            }
          }
        }
      },
      orderBy: [
        { start: "asc" }
      ]
    });

    return NextResponse.json(slots);
  } catch (error) {
    console.error("Error fetching slots:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
    const data = CreateSlotSchema.parse(body);

    // Check if user is a member of this circle
    const membership = await prisma.membership.findFirst({
      where: {
        circleId: params.id,
        userId: session.user.id
      }
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this circle" }, { status: 403 });
    }

    // Validate start/end times
    const startTime = new Date(data.start);
    const endTime = new Date(data.end);
    const now = new Date();

    if (startTime <= now) {
      return NextResponse.json({ error: "Start time must be in the future" }, { status: 400 });
    }

    if (endTime <= startTime) {
      return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
    }

    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60));
    
    if (durationMinutes < data.minDuration) {
      return NextResponse.json({ error: "Slot duration must be at least the minimum duration" }, { status: 400 });
    }

    // Check for overlapping slots from the same provider
    const existingSlots = await prisma.slot.findMany({
      where: {
        providerId: session.user.id,
        status: "OPEN",
        OR: [
          {
            start: {
              lt: endTime,
              gte: startTime
            }
          },
          {
            end: {
              gt: startTime,
              lte: endTime
            }
          },
          {
            start: {
              lte: startTime
            },
            end: {
              gte: endTime
            }
          }
        ]
      }
    });

    if (existingSlots.length > 0) {
      return NextResponse.json({ error: "You have overlapping slots in this time range" }, { status: 400 });
    }

    // Create the slot
    const slot = await prisma.slot.create({
      data: {
        circleId: params.id,
        providerId: session.user.id,
        title: data.title,
        description: data.description,
        category: data.category as any,
        start: startTime,
        end: endTime,
        pricePerMinute: data.pricePerMinute,
        minDuration: data.minDuration,
        maxDuration: data.maxDuration,
        location: data.location,
        status: "OPEN"
      },
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            city: true
          }
        }
      }
    });

    return NextResponse.json(slot);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Error creating slot:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}