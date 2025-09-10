import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Approved categories for Public Good slots
const APPROVED_PUBLIC_CATEGORIES = [
  "ELDERCARE",
  "CHILDCARE",
  "TUTORING",
  "GARDENING",
  "CLEANING",
  "MAINTENANCE",
  "TRANSPORT",
  "CREATIVE",
] as const;

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");

    const categoryFilter = category && APPROVED_PUBLIC_CATEGORIES.includes(category as any)
      ? { category: category as any }
      : { category: { in: APPROVED_PUBLIC_CATEGORIES as any } };

    const slots = await prisma.slot.findMany({
      where: {
        status: "OPEN",
        start: { gt: new Date() },
        ...categoryFilter,
      },
      include: {
        provider: { select: { id: true, name: true } },
        circle: {
          select: {
            id: true,
            name: true,
            treasury: {
              select: {
                id: true,
                currentBalance: true,
                fundingTransactions: {
                  take: 1,
                  orderBy: { processedAt: "desc" },
                  where: { status: "COMPLETED" },
                  select: {
                    fundedBy: { select: { id: true, name: true } },
                    notes: true,
                    processedAt: true,
                  }
                }
              }
            }
          }
        }
      },
      orderBy: [{ start: "asc" }],
      take: 30
    });

    const result = slots.map((s) => {
      const latestFunding = s.circle?.treasury?.fundingTransactions?.[0];
      const sponsored = !!latestFunding;
      const sponsorName = latestFunding?.fundedBy?.name || null;
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        category: s.category,
        start: s.start,
        end: s.end,
        location: s.location,
        pricePerMinute: s.pricePerMinute,
        minDuration: s.minDuration,
        maxDuration: s.maxDuration,
        circleId: s.circleId,
        provider: s.provider,
        sponsored,
        sponsorName,
        circleName: s.circle?.name || undefined,
      };
    });

    return NextResponse.json({ slots: result });
  } catch (e) {
    console.error("Error fetching public good slots:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

