import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ReviewRequestSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().max(500).optional()
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = ReviewRequestSchema.parse(body);

    const result = await prisma.$transaction(async (tx) => {
      // Find the join request
      const joinRequest = await tx.joinRequest.findUnique({
        where: { id: params.id },
        include: {
          circle: true,
          user: true
        }
      });

      if (!joinRequest) {
        throw new Error("Join request not found");
      }

      if (joinRequest.status !== "PENDING") {
        throw new Error("Join request already processed");
      }

      // Check if user can approve/reject
      const membership = await tx.membership.findFirst({
        where: {
          circleId: joinRequest.circleId,
          userId: session.user!.id,
          role: {
            in: ["OWNER", "ADMIN", "MODERATOR"]
          }
        }
      });

      if (!membership) {
        throw new Error("Insufficient permissions");
      }

      const newStatus = data.action === "approve" ? "APPROVED" : "REJECTED";

      // Update join request
      const updatedRequest = await tx.joinRequest.update({
        where: { id: params.id },
        data: {
          status: newStatus,
          reviewedBy: session.user!.id,
          reviewedAt: new Date()
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          reviewer: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        }
      });

      // If approved, create membership
      if (data.action === "approve") {
        await tx.membership.create({
          data: {
            userId: joinRequest.userId,
            circleId: joinRequest.circleId,
            role: "MEMBER",
            balanceCredits: 0
          }
        });
      }

      return updatedRequest;
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Error reviewing join request:", error);
    if (error.message.includes("not found") || error.message.includes("permissions") || error.message.includes("already processed")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}