import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const UpdateCircleSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  description: z.string().optional(),
  city: z.string().max(100).optional(),
  isPrivate: z.boolean().optional(),
  quietHours: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/)
  }).optional(),
  allowsMinors: z.boolean().optional(),
  demurrageRate: z.number().min(0).max(1).optional(),
  categories: z.array(z.string()).optional()
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
    const circle = await prisma.circle.findFirst({
      where: {
        id: params.id,
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
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
          orderBy: [
            { role: "desc" }, // OWNER, MODERATOR, ADMIN, MEMBER
            { createdAt: "asc" }
          ]
        },
        _count: {
          select: {
            requests: true
          }
        }
      }
    });

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    return NextResponse.json(circle);
  } catch (error) {
    console.error("Error fetching circle:", error);
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
    const data = UpdateCircleSchema.parse(body);

    // Check if user has permission to update
    const membership = await prisma.membership.findFirst({
      where: {
        circleId: params.id,
        userId: session.user.id,
        role: {
          in: ["OWNER", "ADMIN"]
        }
      }
    });

    if (!membership) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }

    const circle = await prisma.circle.update({
      where: { id: params.id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.isPrivate !== undefined && { isPrivate: data.isPrivate }),
        ...(data.quietHours !== undefined && { quietHours: data.quietHours }),
        ...(data.allowsMinors !== undefined && { allowsMinors: data.allowsMinors }),
        ...(data.demurrageRate !== undefined && { demurrageRate: data.demurrageRate }),
        ...(data.categories !== undefined && { categories: data.categories })
      },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(circle);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Error updating circle:", error);
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
    // Check if user is the owner
    const circle = await prisma.circle.findFirst({
      where: {
        id: params.id,
        ownerId: session.user.id
      }
    });

    if (!circle) {
      return NextResponse.json({ error: "Circle not found or insufficient permissions" }, { status: 404 });
    }

    await prisma.circle.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting circle:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}