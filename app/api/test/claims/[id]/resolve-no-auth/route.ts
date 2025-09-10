import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { escrowRelease } from "@/lib/credits/ledger";

const ResolveSchema = z.object({
  action: z.enum(["approve", "reject", "auto_resolve"]),
  moderatorNotes: z.string().max(500).optional()
});

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const data = ResolveSchema.parse(body);

    // Get the claim with all relations
    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: params.id },
      include: {
        booking: {
          include: {
            slot: {
              include: {
                circle: true
              }
            }
          }
        },
        pool: true,
        claimant: true,
        respondent: true
      }
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    // For auto-resolution, check if deadline has passed
    if (data.action === "auto_resolve") {
      if (new Date() <= new Date(claim.claimDeadline)) {
        return NextResponse.json({ 
          error: "Cannot auto-resolve before deadline" 
        }, { status: 400 });
      }
      if (claim.status !== "PENDING") {
        return NextResponse.json({ 
          error: "Can only auto-resolve pending claims" 
        }, { status: 400 });
      }
    }

    // Check if claim is already resolved
    if (claim.resolvedAt) {
      return NextResponse.json({ 
        error: "Claim has already been resolved" 
      }, { status: 400 });
    }

    const isApproved = data.action === "approve" || data.action === "auto_resolve";
    const newStatus = isApproved ? "APPROVED" : "REJECTED";

    // Process the resolution in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update claim status
      const updatedClaim = await tx.insuranceClaim.update({
        where: { id: params.id },
        data: {
          status: newStatus,
          resolvedAt: new Date(),
          autoResolved: data.action === "auto_resolve",
          moderatorId: data.action !== "auto_resolve" ? "test-moderator" : null,
          moderatorNotes: data.moderatorNotes
        }
      });

      // If approved, process the payout
      if (isApproved) {
        // Create ledger entry for insurance claim refund
        await tx.ledgerEntry.create({
          data: {
            circleId: claim.booking.slot.circle.id,
            bookingId: claim.bookingId,
            fromUserId: null, // From insurance/system
            toUserId: claim.claimantId,
            amount: claim.amount,
            type: "CREDIT",
            meta: {
              kind: "INSURANCE_CLAIM_REFUND",
              claimId: claim.id,
              claimType: claim.claimType
            }
          }
        });

        // Pay bonus from insurance pool
        if (claim.bonusAmount > 0) {
          await tx.ledgerEntry.create({
            data: {
              circleId: claim.booking.slot.circle.id,
              bookingId: claim.bookingId,
              fromUserId: null, // From insurance pool
              toUserId: claim.claimantId,
              amount: claim.bonusAmount,
              type: "CREDIT",
              meta: {
                kind: "INSURANCE_BONUS",
                claimId: claim.id,
                claimType: claim.claimType,
                bonusPercentage: 20
              }
            }
          });

          // Deduct from insurance pool
          await tx.insurancePool.update({
            where: { id: claim.poolId },
            data: {
              balance: {
                decrement: claim.bonusAmount
              }
            }
          });
        }

        // Update membership balance for claimant
        await tx.membership.updateMany({
          where: {
            userId: claim.claimantId,
            circleId: claim.booking.slot.circle.id
          },
          data: {
            balanceCredits: {
              increment: claim.totalPayout
            }
          }
        });
      }

      return updatedClaim;
    });

    return NextResponse.json({
      claim: result,
      success: true,
      message: isApproved 
        ? `Claim approved! ${claim.claimant.name} will receive ${claim.totalPayout} credits (${claim.amount} refund + ${claim.bonusAmount} bonus).`
        : "Claim rejected."
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid resolution data", 
        details: error.errors 
      }, { status: 400 });
    }
    console.error("Error resolving claim:", error);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}