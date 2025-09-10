import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
    const { month, year } = body;

    // Verify user can manage treasury
    const circle = await prisma.circle.findFirst({
      where: { id: circleId },
      include: { treasury: true }
    });

    if (!circle) {
      return NextResponse.json({ error: "Circle not found" }, { status: 404 });
    }

    const canManage = circle.ownerId === session.user.id || 
                      circle.treasury?.adminUserId === session.user.id;

    if (!canManage) {
      return NextResponse.json({ error: "Only treasury admins can distribute allowances" }, { status: 403 });
    }

    if (!circle.treasury) {
      return NextResponse.json({ error: "Treasury not configured" }, { status: 400 });
    }

    // Use defaults if not provided
    const now = new Date();
    const distributionMonth = month || (now.getMonth() + 1);
    const distributionYear = year || now.getFullYear();

    // Call the admin distribution endpoint
    const response = await fetch(`${process.env.NEXTAUTH_URL}/api/admin/treasury/distribute-allowances`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        treasuryId: circle.treasury.id,
        month: distributionMonth,
        year: distributionYear
      })
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        error: result.error || "Distribution failed",
        details: result.details
      }, { status: response.status });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Error triggering allowance distribution:", error);
    return NextResponse.json({ 
      error: "Failed to distribute allowances",
      details: error.message 
    }, { status: 500 });
  }
}