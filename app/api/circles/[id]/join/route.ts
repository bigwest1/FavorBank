import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const JoinRequestSchema = z.object({
  message: z.string().max(500).optional()
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
    const data = JoinRequestSchema.parse(body);

    // Check if circle exists and is private
    const circle = await prisma.circle.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        name: true,
        isPrivate: true
      }
    });

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    if (!circle.isPrivate) {
      return NextResponse.json({ error: "This circle allows direct joining" }, { status: 400 });
    }

    // Check if user is already a member
    const existingMembership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        circleId: params.id
      }
    });

    if (existingMembership) {
      return NextResponse.json({ error: "Already a member of this circle" }, { status: 400 });
    }

    // Check if there's already a pending request
    const existingRequest = await prisma.joinRequest.findFirst({
      where: {
        userId: session.user.id,
        circleId: params.id,
        status: "PENDING"
      }
    });

    if (existingRequest) {
      return NextResponse.json({ error: "Join request already pending" }, { status: 400 });
    }

    const joinRequest = await prisma.joinRequest.create({
      data: {
        userId: session.user.id,
        circleId: params.id,
        message: data.message,
        status: "PENDING"
      },
      include: {
        circle: {
          select: {
            name: true
          }
        },
        user: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(joinRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Error creating join request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}