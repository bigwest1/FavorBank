import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordFeeSurcharge } from "@/lib/fees/ledger";

export async function POST(request: NextRequest) {
  try {
    const { baseAmount, feeBreakdown, testBookingId } = await request.json();

    // Record the fee surcharge
    const feeContext = {
      circleId: "test-circle-id",
      userId: "test-user-id", 
      bookingId: testBookingId,
      transactionType: "booking" as const,
      feeBreakdown: {
        baseAmount,
        fees: feeBreakdown.fees,
        totalSurcharge: feeBreakdown.totalSurcharge,
        finalAmount: feeBreakdown.finalAmount,
        capped: feeBreakdown.capped,
        capReason: feeBreakdown.capReason
      }
    };

    await recordFeeSurcharge(feeContext);

    return NextResponse.json({ 
      success: true, 
      message: "Fee surcharge recorded successfully",
      feeContext 
    });
  } catch (error: any) {
    console.error("Error testing fee ledger:", error);
    return NextResponse.json({ 
      error: "Failed to record fee surcharge",
      details: error.message 
    }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Get recent FEE_SURCHARGE entries
    const entries = await prisma.ledgerEntry.findMany({
      where: {
        meta: {
          path: "$.kind",
          equals: "FEE_SURCHARGE"
        }
      },
      orderBy: { timestamp: "desc" },
      take: 20
    });

    return NextResponse.json(entries);
  } catch (error: any) {
    console.error("Error fetching ledger entries:", error);
    return NextResponse.json({ 
      error: "Failed to fetch ledger entries",
      details: error.message 
    }, { status: 500 });
  }
}