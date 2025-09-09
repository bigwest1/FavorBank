import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const invite = await prisma.circleInvite.findFirst({
      where: {
        token: params.token,
        usedById: null, // Not yet used
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        circle: {
          select: {
            id: true,
            name: true,
            description: true,
            city: true,
            isPrivate: true
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

    if (!invite) {
      return NextResponse.json({ error: "Invalid or expired invite" }, { status: 404 });
    }

    return NextResponse.json(invite);
  } catch (error) {
    console.error("Error fetching invite:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Must be logged in to accept invite" }, { status: 401 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // Find and validate invite
      const invite = await tx.circleInvite.findFirst({
        where: {
          token: params.token,
          usedById: null, // Not yet used
          expiresAt: {
            gt: new Date()
          }
        },
        include: {
          circle: true
        }
      });

      if (!invite) {
        throw new Error("Invalid or expired invite");
      }

      // Check if user is already a member
      const existingMembership = await tx.membership.findFirst({
        where: {
          userId: session.user!.id,
          circleId: invite.circleId
        }
      });

      if (existingMembership) {
        throw new Error("Already a member of this circle");
      }

      // Mark invite as used
      await tx.circleInvite.update({
        where: { id: invite.id },
        data: {
          usedById: session.user!.id,
          usedAt: new Date()
        }
      });

      // Create membership
      const membership = await tx.membership.create({
        data: {
          userId: session.user!.id,
          circleId: invite.circleId,
          role: "MEMBER",
          balanceCredits: 0
        }
      });

      return { circle: invite.circle, membership };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error accepting invite:", error);
    if (error.message === "Invalid or expired invite" || error.message === "Already a member of this circle") {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}