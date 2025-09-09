import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateOfferSchema = z.object({
  message: z.string().max(1000).optional(),
  proposedStartAt: z.string().datetime().optional(),
  estimatedHours: z.number().min(0.25).max(24).optional(),
  helperPhone: z.string().max(50).optional(),
  helperEmail: z.string().email().optional()
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
    // Check if user has access to this request (member of the circle)
    const requestData = await prisma.request.findFirst({
      where: {
        id: params.id,
        circle: {
          memberships: {
            some: {
              userId: session.user.id
            }
          }
        }
      },
      select: {
        userId: true
      }
    });

    if (!requestData) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const isOwner = requestData.userId === session.user.id;

    // Get offers - reveal contact info only if request owner or the offer is from current user
    const offers = await prisma.offer.findMany({
      where: {
        requestId: params.id,
        status: "PENDING"
      },
      include: {
        helper: {
          select: {
            id: true,
            name: true,
            email: !isOwner, // Hide email unless you're the request owner
            city: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    // Filter contact info based on permissions
    const filteredOffers = offers.map(offer => ({
      ...offer,
      helperPhone: (isOwner || offer.helperId === session.user.id) ? offer.helperPhone : null,
      helperEmail: (isOwner || offer.helperId === session.user.id) ? offer.helperEmail : null
    }));

    return NextResponse.json(filteredOffers);
  } catch (error) {
    console.error("Error fetching offers:", error);
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
    const data = CreateOfferSchema.parse(body);

    // Check if request exists and user can offer help
    const requestData = await prisma.request.findFirst({
      where: {
        id: params.id,
        status: "OPEN",
        circle: {
          memberships: {
            some: {
              userId: session.user.id
            }
          }
        }
      }
    });

    if (!requestData) {
      return NextResponse.json({ error: "Request not found or not available" }, { status: 404 });
    }

    // Can't offer help on your own request
    if (requestData.userId === session.user.id) {
      return NextResponse.json({ error: "Cannot offer help on your own request" }, { status: 400 });
    }

    // Check if user already has a pending offer
    const existingOffer = await prisma.offer.findFirst({
      where: {
        requestId: params.id,
        helperId: session.user.id,
        status: "PENDING"
      }
    });

    if (existingOffer) {
      return NextResponse.json({ error: "You already have a pending offer for this request" }, { status: 400 });
    }

    // Validate proposed start time is within request window
    if (data.proposedStartAt && requestData.timeWindowStart && requestData.timeWindowEnd) {
      const proposedDate = new Date(data.proposedStartAt);
      const windowStart = new Date(requestData.timeWindowStart);
      const windowEnd = new Date(requestData.timeWindowEnd);
      
      if (proposedDate < windowStart || proposedDate > windowEnd) {
        return NextResponse.json({ 
          error: "Proposed start time must be within the request's time window" 
        }, { status: 400 });
      }
    }

    // Create the offer
    const offer = await prisma.offer.create({
      data: {
        requestId: params.id,
        helperId: session.user.id,
        message: data.message,
        proposedStartAt: data.proposedStartAt ? new Date(data.proposedStartAt) : null,
        estimatedHours: data.estimatedHours,
        helperPhone: data.helperPhone,
        helperEmail: data.helperEmail
      },
      include: {
        helper: {
          select: {
            id: true,
            name: true,
            email: true,
            city: true
          }
        },
        request: {
          select: {
            title: true,
            user: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(offer);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Error creating offer:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}