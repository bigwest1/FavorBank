import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { calculateCreditsOffered } from "@/lib/credits/calculator";
import { escrowLock } from "@/lib/credits/ledger";

const CreateRequestSchema = z.object({
  title: z.string().min(5).max(100),
  description: z.string().min(10).max(2000).optional(),
  category: z.enum([
    "HOUSEHOLD_TASKS", "YARD_WORK", "PET_CARE", "CHILD_CARE", "ELDER_CARE",
    "TRANSPORTATION", "TECH_SUPPORT", "HOME_REPAIR", "MOVING_HELP", "ERRANDS",
    "COOKING", "TUTORING", "CREATIVE_PROJECTS", "EVENT_HELP", "OTHER"
  ]),
  photoBase64: z.string().optional(),
  effortLevel: z.number().min(1).max(5).default(3),
  tier: z.enum(["BASIC", "PRIORITY", "GUARANTEED"]).default("BASIC"),
  timeWindowStart: z.string().datetime().optional(),
  timeWindowEnd: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  locationRadius: z.number().min(0).max(100).optional(),
  address: z.string().max(500).optional(),
  city: z.string().max(100).optional(),
  equipmentNeeded: z.array(z.string()).optional(),
  specialRequirements: z.string().max(500).optional()
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
    const tier = searchParams.get("tier");
    const status = searchParams.get("status") || "OPEN";

    const requests = await prisma.request.findMany({
      where: {
        circleId: params.id,
        status: status as any,
        ...(category && { category: category as any }),
        ...(tier && { tier: tier as any }),
        // Don't show expired requests
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        _count: {
          select: {
            bookings: true
          }
        }
      },
      orderBy: [
        { tier: "desc" }, // GUARANTEED first
        { createdAt: "desc" }
      ]
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error fetching requests:", error);
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
    const data = CreateRequestSchema.parse(body);

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

    // Calculate credits based on effort and other factors
    const timeWindowHours = data.timeWindowStart && data.timeWindowEnd 
      ? Math.abs(new Date(data.timeWindowEnd).getTime() - new Date(data.timeWindowStart).getTime()) / (1000 * 60 * 60)
      : undefined;

    const creditsOffered = calculateCreditsOffered({
      effortLevel: data.effortLevel,
      category: data.category,
      timeWindowHours,
      hasEquipment: data.equipmentNeeded && data.equipmentNeeded.length > 0,
      locationRadius: data.locationRadius
    });

    // Check if user has enough credits
    if (membership.balanceCredits < creditsOffered) {
      return NextResponse.json({ 
        error: "Insufficient credits", 
        required: creditsOffered, 
        available: membership.balanceCredits 
      }, { status: 400 });
    }

    // Create request and escrow credits in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the request
      const newRequest = await tx.request.create({
        data: {
          circleId: params.id,
          userId: session.user!.id,
          title: data.title,
          description: data.description,
          category: data.category as any,
          photoBase64: data.photoBase64,
          effortLevel: data.effortLevel,
          creditsOffered,
          tier: data.tier as any,
          timeWindowStart: data.timeWindowStart ? new Date(data.timeWindowStart) : null,
          timeWindowEnd: data.timeWindowEnd ? new Date(data.timeWindowEnd) : null,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
          locationRadius: data.locationRadius,
          address: data.address,
          city: data.city,
          equipmentNeeded: data.equipmentNeeded,
          specialRequirements: data.specialRequirements
        }
      });

      // Escrow lock the credits
      await escrowLock(tx, params.id, session.user!.id, creditsOffered, null, {
        kind: "REQUEST_ESCROW",
        requestId: newRequest.id
      });

      return newRequest;
    });

    // Return the created request
    const request = await prisma.request.findUnique({
      where: { id: result.id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(request);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Error creating request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}