import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ResponseSchema = z.object({
  response: z.string().min(10).max(500)
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
    const data = ResponseSchema.parse(body);

    // Get the claim
    const claim = await prisma.insuranceClaim.findUnique({
      where: { id: params.id },
      include: {
        claimant: true,
        respondent: true,
        booking: true
      }
    });

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    // Check if user is the respondent (provider)
    if (claim.respondentId !== session.user.id) {
      return NextResponse.json({ error: "Only the provider can respond to this claim" }, { status: 403 });
    }

    // Check if claim is still pending
    if (claim.status !== "PENDING") {
      return NextResponse.json({ 
        error: "Can only respond to pending claims" 
      }, { status: 400 });
    }

    // Check if deadline has passed
    if (new Date() > new Date(claim.claimDeadline)) {
      return NextResponse.json({ 
        error: "Response deadline has passed" 
      }, { status: 400 });
    }

    // Check if helper has already responded
    if (claim.helperResponse) {
      return NextResponse.json({ 
        error: "You have already responded to this claim" 
      }, { status: 400 });
    }

    // Update claim with helper response
    const updatedClaim = await prisma.insuranceClaim.update({
      where: { id: params.id },
      data: {
        helperResponse: data.response,
        helperRespondedAt: new Date(),
        status: "HELPER_RESPONDED"
      },
      include: {
        claimant: {
          select: { id: true, name: true, email: true }
        },
        respondent: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    return NextResponse.json({
      claim: updatedClaim,
      success: true,
      message: "Response submitted successfully. A moderator will review the claim."
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: "Invalid response data", 
        details: error.errors 
      }, { status: 400 });
    }
    console.error("Error submitting claim response:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}