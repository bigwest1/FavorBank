import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { escrowLock, insurancePremium } from "@/lib/credits/ledger";
import { FeesContext } from "@/lib/fees/context";
import { recordFeeSurcharge } from "@/lib/fees/ledger";

const BookSlotSchema = z.object({
  duration: z.number().min(5).max(480), // Duration in minutes
  notes: z.string().max(500).optional(),
  feeContext: z.object({
    isUrgent: z.boolean().optional(),
    needsEquipment: z.boolean().optional(),
    isGuaranteed: z.boolean().optional(),
    crossCircle: z.boolean().optional()
  }).optional(),
  wantInsurance: z.boolean().optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const data = BookSlotSchema.parse(body);

    // Get the slot with availability check
    const slot = await prisma.slot.findFirst({
      where: {
        id: params.id,
        status: "OPEN",
        start: {
          gt: new Date() // Only future slots
        }
      },
      include: {
        provider: true,
        circle: true,
        bookings: {
          where: {
            status: {
              in: ["PENDING", "CONFIRMED"]
            }
          }
        }
      }
    });

    if (!slot) {
      return NextResponse.json({ error: "Slot not found or no longer available" }, { status: 404 });
    }

    // Can't book your own slot
    if (slot.providerId === session.user.id) {
      return NextResponse.json({ error: "Cannot book your own slot" }, { status: 400 });
    }

    // Check if user is a member of the circle
    const membership = await prisma.membership.findFirst({
      where: {
        circleId: slot.circleId,
        userId: session.user.id
      }
    });

    if (!membership) {
      return NextResponse.json({ error: "Not a member of this circle" }, { status: 403 });
    }

    // Validate duration
    if (data.duration < slot.minDuration) {
      return NextResponse.json({ 
        error: `Minimum booking duration is ${slot.minDuration} minutes` 
      }, { status: 400 });
    }

    if (slot.maxDuration && data.duration > slot.maxDuration) {
      return NextResponse.json({ 
        error: `Maximum booking duration is ${slot.maxDuration} minutes` 
      }, { status: 400 });
    }

    // Calculate total slot duration
    const slotDurationMinutes = Math.round(
      (new Date(slot.end).getTime() - new Date(slot.start).getTime()) / (1000 * 60)
    );

    // Check if there's already too much booked time
    const bookedMinutes = slot.bookings.reduce((total, booking) => 
      total + (booking.duration || 0), 0
    );

    if (bookedMinutes + data.duration > slotDurationMinutes) {
      return NextResponse.json({ 
        error: `Only ${slotDurationMinutes - bookedMinutes} minutes remaining in this slot` 
      }, { status: 400 });
    }

    // Calculate base credits needed
    const baseCredits = data.duration * slot.pricePerMinute;

    // Calculate dynamic fees
    const bookingContext = {
      startTime: new Date(slot.start),
      endTime: new Date(slot.end),
      duration: data.duration,
      category: slot.category,
      location: slot.location || undefined,
      requirements: data.notes,
      isUrgent: data.feeContext?.isUrgent,
      needsEquipment: data.feeContext?.needsEquipment,
      isGuaranteed: data.feeContext?.isGuaranteed,
      crossCircle: data.feeContext?.crossCircle,
      providerId: slot.providerId,
      bookerId: session.user.id,
      circleId: slot.circleId
    };

    const feeCalculation = FeesContext.calculateFees(baseCredits, bookingContext);
    
    // Check if insurance is requested and eligible
    const isInsuranceEligible = slot.category === "MOVING" || slot.category === "FURNITURE";
    const wantInsurance = data.wantInsurance && isInsuranceEligible;
    const insuranceCost = wantInsurance ? 2 : 0;
    
    const totalCredits = feeCalculation.finalAmount + insuranceCost;

    // Check if user has enough credits (including fees)
    if (membership.balanceCredits < totalCredits) {
      return NextResponse.json({ 
        error: "Insufficient credits", 
        required: totalCredits,
        baseAmount: baseCredits,
        fees: feeCalculation.totalSurchargeAmount,
        available: membership.balanceCredits 
      }, { status: 400 });
    }

    // Create booking and escrow credits in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the booking
      const booking = await tx.booking.create({
        data: {
          slotId: slot.id,
          providerId: slot.providerId,
          bookerId: session.user!.id,
          duration: data.duration,
          totalCredits,
          bookerNotes: data.notes,
          status: "CONFIRMED", // SlotShop bookings are auto-confirmed
          hasInsurance: wantInsurance
        }
      });

      // Record fee surcharge if applicable
      if (feeCalculation.totalSurchargeAmount > 0) {
        const feeContext = {
          circleId: slot.circleId,
          userId: session.user!.id,
          bookingId: booking.id,
          transactionType: "booking" as const,
          feeBreakdown: {
            baseAmount: baseCredits,
            fees: feeCalculation.appliedFees.map(fee => ({
              id: fee.rule.id,
              name: fee.rule.name,
              percentage: fee.percentage,
              amount: fee.amount
            })),
            totalSurcharge: feeCalculation.totalSurchargeAmount,
            finalAmount: feeCalculation.finalAmount,
            capped: feeCalculation.capped,
            capReason: feeCalculation.capReason
          }
        };
        
        await recordFeeSurcharge(feeContext, tx);
      }

      // Process insurance premium if selected
      if (wantInsurance) {
        await insurancePremium(tx, slot.circleId, session.user!.id, insuranceCost, {
          bookingId: booking.id,
          slotId: slot.id,
          category: slot.category,
          coverageAmount: 500 // Up to $500 coverage
        });
      }

      // Escrow lock the credits (including fees)
      await escrowLock(tx, slot.circleId, session.user!.id, totalCredits, booking.id, {
        kind: "SLOT_BOOKING",
        slotId: slot.id,
        bookingId: booking.id,
        duration: data.duration,
        baseAmount: baseCredits,
        totalFees: feeCalculation.totalSurchargeAmount
      });

      // If the slot is fully booked, mark it as BOOKED
      const newBookedMinutes = bookedMinutes + data.duration;
      if (newBookedMinutes >= slotDurationMinutes) {
        await tx.slot.update({
          where: { id: slot.id },
          data: { status: "BOOKED" }
        });
      }

      return booking;
    });

    // Return the booking with full details
    const fullBooking = await prisma.booking.findUnique({
      where: { id: result.id },
      include: {
        slot: {
          include: {
            provider: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        },
        booker: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(fullBooking);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", details: error.errors }, { status: 400 });
    }
    console.error("Error booking slot:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}