import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Create a few sample notifications
    const created = await prisma.$transaction(async (tx) => {
      const items = [] as any[];
      items.push(await tx.notification.create({ data: {
        userId: session.user!.id, type: 'new_offer', payload: { message: 'New offer on your request', requestId: 'test' }
      }}));
      items.push(await tx.notification.create({ data: {
        userId: session.user!.id, type: 'booking_reminder', payload: { message: 'Booking at 3:00 PM today', bookingId: 'test' }
      }}));
      items.push(await tx.notification.create({ data: {
        userId: session.user!.id, type: 'start_nudge', payload: { message: 'Time to start your favor!', bookingId: 'test' }
      }}));
      return items;
    });

    return NextResponse.json({ success: true, created });
  } catch (e) {
    console.error("Create test notifications error:", e);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

