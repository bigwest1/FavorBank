import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const membership = await prisma.membership.findFirst({ where: { circleId: params.id, userId: session.user.id } });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
    const prefs = await prisma.notificationPreference.findUnique({
      where: { userId_circleId: { userId: session.user.id, circleId: params.id } }
    });
    return NextResponse.json({
      preferences: prefs || {
        userId: session.user.id,
        circleId: params.id,
        newOffers: true,
        bookingReminders: true,
        startFinishNudges: true,
        dailyEmail: true,
      }
    });
  } catch (e) {
    console.error('GET notification prefs error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const UpdateSchema = z.object({
  newOffers: z.boolean().optional(),
  bookingReminders: z.boolean().optional(),
  startFinishNudges: z.boolean().optional(),
  dailyEmail: z.boolean().optional(),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const membership = await prisma.membership.findFirst({ where: { circleId: params.id, userId: session.user.id } });
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });
    const body = await request.json();
    const data = UpdateSchema.parse(body);
    const updated = await prisma.notificationPreference.upsert({
      where: { userId_circleId: { userId: session.user.id, circleId: params.id } },
      update: { ...data },
      create: { userId: session.user.id, circleId: params.id, ...data },
    });
    return NextResponse.json({ success: true, preferences: updated });
  } catch (e: any) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: 'Invalid input', details: e.errors }, { status: 400 });
    console.error('PUT notification prefs error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

