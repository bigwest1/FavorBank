import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const now = new Date();
    const expireBefore = now.toISOString();

    const [expiredRequests, expiredSlots] = await prisma.$transaction([
      prisma.request.updateMany({
        where: { status: 'OPEN', expiresAt: { lt: now } },
        data: { status: 'CANCELLED' }
      }),
      prisma.slot.updateMany({
        where: { status: 'OPEN', end: { lt: now } },
        data: { status: 'CANCELLED' }
      })
    ]);

    return NextResponse.json({ success: true, expiredRequests: expiredRequests.count, expiredSlots: expiredSlots.count, at: expireBefore });
  } catch (e) {
    console.error('Cron expire error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

