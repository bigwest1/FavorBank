import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CreateCircleSchema = z.object({
  name: z.string().min(2).max(50),
  description: z.string().optional(),
  city: z.string().max(100).optional(),
  isPrivate: z.boolean().default(false),
  quietHours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/)
  }).optional(),
  allowsMinors: z.boolean().default(true),
  demurrageRate: z.number().min(0).max(1).default(0),
  categories: z.array(z.string()).optional()
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const circles = await prisma.circle.findMany({
      where: {
        memberships: {
          some: {
            userId: session.user.id
          }
        }
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        memberships: {
          where: {
            userId: session.user.id
          },
          select: {
            role: true,
            balanceCredits: true
          }
        },
        _count: {
          select: {
            memberships: true,
            requests: true
          }
        }
      }
    });

    return NextResponse.json(circles);
  } catch (error) {
    console.error("Error fetching circles:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = CreateCircleSchema.parse(body);

    const circle = await prisma.$transaction(async (tx) => {
      // Create the circle
      const newCircle = await tx.circle.create({
        data: {
          name: data.name,
          description: data.description,
          city: data.city,
          ownerId: session.user!.id,
          isPrivate: data.isPrivate,
          quietHours: data.quietHours,
          allowsMinors: data.allowsMinors,
          demurrageRate: data.demurrageRate,
          categories: data.categories
        }
      });

      // Create owner membership
      await tx.membership.create({
        data: {
          userId: session.user!.id,
          circleId: newCircle.id,
          role: "OWNER",
          balanceCredits: 0
        }
      });

      return newCircle;
    });

    return NextResponse.json(circle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Error creating circle:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}