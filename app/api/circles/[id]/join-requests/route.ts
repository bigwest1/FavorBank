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
    // Check if user can manage join requests
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

    const joinRequests = await prisma.joinRequest.findMany({
      where: {
        circleId: params.id
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
      },
      orderBy: [
        { status: "asc" }, // PENDING first
        { createdAt: "desc" }
      ]
    });

    return NextResponse.json(joinRequests);
  } catch (error) {
    console.error("Error fetching join requests:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}