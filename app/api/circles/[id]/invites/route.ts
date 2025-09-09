import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { nanoid } from "nanoid";

const CreateInviteSchema = z.object({
  email: z.string().email().optional(),
  expiresInHours: z.number().min(1).max(168).default(72) // Default 3 days, max 1 week
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
    // Check if user can manage invites
    const membership = await prisma.membership.findFirst({
      where: {
        circleId: params.id,
        userId: session.user.id,
        role: {
          in: ["OWNER", "ADMIN", "MODERATOR"]
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const invites = await prisma.circleInvite.findMany({
      where: {
        circleId: params.id
      },
      include: {
        inviter: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        usedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    return NextResponse.json(invites);
  } catch (error) {
    console.error("Error fetching invites:", error);
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
    const data = CreateInviteSchema.parse(body);

    // Check if user can create invites
    const membership = await prisma.membership.findFirst({
      where: {
        circleId: params.id,
        userId: session.user.id,
        role: {
          in: ["OWNER", "ADMIN", "MODERATOR"]
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    // Generate secure token
    const token = nanoid(32);
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + data.expiresInHours);

    const invite = await prisma.circleInvite.create({
      data: {
        circleId: params.id,
        inviterId: session.user.id,
        token,
        email: data.email,
        expiresAt
      },
      include: {
        circle: {
          select: {
            name: true
          }
        },
        inviter: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(invite);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Error creating invite:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}