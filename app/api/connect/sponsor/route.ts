import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Most recent completed treasury funding to show sponsor
    const latest = await prisma.treasuryFunding.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { processedAt: "desc" },
      include: {
        treasury: { include: { circle: true } },
        fundedBy: { select: { id: true, name: true } }
      }
    });

    if (!latest) return NextResponse.json({ sponsor: null });

    return NextResponse.json({
      sponsor: {
        message: "Local partner is fueling community favors",
        sponsorName: latest.fundedBy?.name || null,
        circleName: latest.treasury.circle.name
      }
    });
  } catch (e) {
    console.error("Error fetching sponsor:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

