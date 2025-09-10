import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // Get all slots with Pro provider information
    const slots = await prisma.slot.findMany({
      include: {
        provider: {
          select: {
            id: true,
            name: true,
            proProfile: {
              select: {
                status: true,
                stripePayoutsEnabled: true
              }
            }
          }
        },
        circle: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10 // Show recent slots
    });

    // Transform slots to include Pro status information
    const slotsWithProInfo = slots.map(slot => ({
      id: slot.id,
      title: slot.title,
      description: slot.description,
      category: slot.category,
      pricePerMinute: slot.pricePerMinute,
      minDuration: slot.minDuration,
      status: slot.status,
      circle: slot.circle,
      provider: {
        id: slot.provider.id,
        name: slot.provider.name,
        isProUser: slot.provider.proProfile?.status === "APPROVED",
        canEarnCashBonus: slot.provider.proProfile?.status === "APPROVED" && 
                         slot.provider.proProfile?.stripePayoutsEnabled === true
      }
    }));

    return NextResponse.json({
      success: true,
      totalSlots: slots.length,
      slots: slotsWithProInfo,
      proUserCount: slotsWithProInfo.filter(s => s.provider.isProUser).length,
      cashBonusEligibleCount: slotsWithProInfo.filter(s => s.provider.canEarnCashBonus).length
    });

  } catch (error: any) {
    console.error("Error fetching slots with Pro badges:", error);
    return NextResponse.json({ 
      error: "Failed to fetch slots",
      details: error.message 
    }, { status: 500 });
  }
}