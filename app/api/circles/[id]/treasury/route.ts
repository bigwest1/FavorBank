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
    const circleId = params.id;
    
    // Verify user has access to this circle
    const membership = await prisma.membership.findFirst({
      where: {
        userId: session.user.id,
        circleId: circleId,
        isActive: true
      }
    });

    if (!membership) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Get circle with treasury info
    const circle = await prisma.circle.findUnique({
      where: { id: circleId },
      include: {
        treasury: {
          include: {
            fundingTransactions: {
              orderBy: { createdAt: "desc" },
              take: 10
            },
            allowanceDistributions: {
              orderBy: { createdAt: "desc" },
              take: 6
            }
          }
        },
        memberships: {
          where: { isActive: true },
          select: { id: true }
        }
      }
    });

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    // Check if user can manage treasury (owner or designated admin)
    const canManage = circle.ownerId === session.user.id || 
                      circle.treasury?.adminUserId === session.user.id;

    return NextResponse.json({
      circle: {
        id: circle.id,
        name: circle.name,
        ownerId: circle.ownerId
      },
      treasury: circle.treasury,
      memberCount: circle.memberships.length,
      canManage,
      userRole: membership.role
    });

  } catch (error: any) {
    console.error("Error fetching treasury data:", error);
    return NextResponse.json({ 
      error: "Failed to load treasury data",
      details: error.message 
    }, { status: 500 });
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
    const circleId = params.id;
    const body = await request.json();
    
    // Verify user owns this circle
    const circle = await prisma.circle.findFirst({
      where: {
        id: circleId,
        ownerId: session.user.id
      }
    });

    if (!circle) {
      return NextResponse.json({ error: "Only circle owners can create treasuries" }, { status: 403 });
    }

    // Create or update treasury
    const treasury = await prisma.circleTreasury.upsert({
      where: { circleId: circleId },
      create: {
        circleId: circleId,
        monthlyAllowanceTotal: body.monthlyAllowanceTotal || 0,
        allowancePerMember: body.allowancePerMember || 0,
        isAllowanceActive: body.isAllowanceActive || false,
        isMatchingActive: body.isMatchingActive || false,
        matchRatio: body.matchRatio || 1.0,
        maxMatchPerBooking: body.maxMatchPerBooking,
        adminUserId: body.adminUserId || session.user.id
      },
      update: {
        monthlyAllowanceTotal: body.monthlyAllowanceTotal,
        allowancePerMember: body.allowancePerMember,
        isAllowanceActive: body.isAllowanceActive,
        isMatchingActive: body.isMatchingActive,
        matchRatio: body.matchRatio,
        maxMatchPerBooking: body.maxMatchPerBooking,
        adminUserId: body.adminUserId
      }
    });

    return NextResponse.json({ treasury });

  } catch (error: any) {
    console.error("Error creating/updating treasury:", error);
    return NextResponse.json({ 
      error: "Failed to save treasury settings",
      details: error.message 
    }, { status: 500 });
  }
}