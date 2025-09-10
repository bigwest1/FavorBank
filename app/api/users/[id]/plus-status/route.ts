import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { PlusService } from "@/lib/plus/service";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Users can only check their own Plus status
  if (session.user.id !== params.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const plusDetails = await PlusService.getUserPlusDetails(params.id);
    
    return NextResponse.json({
      isActive: plusDetails?.isActive || false,
      subscription: plusDetails ? {
        status: plusDetails.status,
        currentPeriodEnd: plusDetails.currentPeriodEnd,
        subscribedAt: plusDetails.subscribedAt,
      } : null
    });
  } catch (error: any) {
    console.error("Error getting Plus status:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error.message 
    }, { status: 500 });
  }
}