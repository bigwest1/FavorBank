import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const Schema = z.object({
  lat: z.number(),
  lng: z.number(),
  accuracy: z.number().optional()
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const data = Schema.parse(body);

    const booking = await prisma.booking.findUnique({
      where: { id: params.id },
      include: { slot: true }
    });
    if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });

    // Find circle admins/moderators
    const admins = await prisma.membership.findMany({
      where: { circleId: booking.circleId, role: { in: ['OWNER', 'MODERATOR'] } },
      select: { userId: true }
    });

    const notifications = admins.map(a => ({
      userId: a.userId,
      circleId: booking.circleId,
      type: 'sos',
      payload: {
        bookingId: booking.id,
        slotId: booking.slotId,
        fromUserId: session.user!.id,
        lat: data.lat,
        lng: data.lng,
        accuracy: data.accuracy,
        createdAt: new Date().toISOString()
      }
    }));

    await prisma.notification.createMany({ data: notifications });

    return NextResponse.json({ success: true, sent: notifications.length });
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Invalid input', details: e.errors }, { status: 400 });
    console.error('SOS error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

