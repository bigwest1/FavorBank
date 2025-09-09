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
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        circle: {
          select: {
            id: true,
            name: true
          }
        },
        bookings: {
          include: {
            provider: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!requestData) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    return NextResponse.json(requestData);
  } catch (error) {
    console.error("Error fetching request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
    const { status } = body;

    // Check if user owns this request
    const existingRequest = await prisma.request.findFirst({
      where: {
        id: params.id,
        userId: session.user.id
      }
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found or not owned by user" }, { status: 404 });
    }

    // Only allow certain status transitions
    const allowedTransitions = {
      "OPEN": ["CANCELLED"],
      "BOOKED": ["COMPLETED", "CANCELLED"],
      "COMPLETED": [],
      "CANCELLED": []
    };

    const currentStatus = existingRequest.status;
    if (!allowedTransitions[currentStatus as keyof typeof allowedTransitions]?.includes(status)) {
      return NextResponse.json({ error: "Invalid status transition" }, { status: 400 });
    }

    // Update the request
    const updatedRequest = await prisma.request.update({
      where: { id: params.id },
      data: { status },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        circle: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    return NextResponse.json(updatedRequest);
  } catch (error) {
    console.error("Error updating request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if user owns this request and it's still open
    const existingRequest = await prisma.request.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
        status: "OPEN"
      }
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found, not owned by user, or not deletable" }, { status: 404 });
    }

    // Delete in transaction to handle escrow release
    await prisma.$transaction(async (tx) => {
      // Release escrowed credits back to user
      // Find the escrow lock entry
      const escrowEntry = await tx.ledgerEntry.findFirst({
        where: {
          circleId: existingRequest.circleId,
          fromUserId: session.user!.id,
          type: "DEBIT",
          meta: {
            path: ["kind"],
            equals: "REQUEST_ESCROW"
          }
        }
      });

      if (escrowEntry) {
        // Release the escrow
        await tx.ledgerEntry.createMany({
          data: [
            {
              circleId: existingRequest.circleId,
              fromUserId: null,
              toUserId: session.user!.id,
              type: "CREDIT",
              amount: existingRequest.creditsOffered,
              meta: { kind: "ESCROW_RELEASE", requestId: params.id }
            },
            {
              circleId: existingRequest.circleId,
              fromUserId: session.user!.id,
              toUserId: null,
              type: "DEBIT",
              amount: existingRequest.creditsOffered,
              meta: { kind: "ESCROW_RELEASE", requestId: params.id }
            }
          ]
        });

        // Update membership balance
        await tx.membership.update({
          where: {
            userId_circleId: {
              userId: session.user!.id,
              circleId: existingRequest.circleId
            }
          },
          data: {
            balanceCredits: {
              increment: existingRequest.creditsOffered
            }
          }
        });
      }

      // Delete the request
      await tx.request.delete({
        where: { id: params.id }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}