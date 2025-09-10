import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function monthBounds(ym: string | null) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (ym && /^\d{4}-\d{2}$/.test(ym)) {
    const [y, m] = ym.split('-').map(Number);
    year = y; month = m - 1;
  }
  const start = new Date(year, month, 1, 0, 0, 0, 0);
  const end = new Date(year, month + 1, 0, 23, 59, 59, 999);
  return { start, end, year, month: month + 1 };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    // Ensure membership
    const membership = await prisma.membership.findFirst({ where: { circleId: params.id, userId: session.user.id } });
    if (!membership) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const ym = searchParams.get('month');
    const { start, end, year, month } = monthBounds(ym);

    const bookings = await prisma.booking.findMany({
      where: {
        circleId: params.id,
        status: 'COMPLETED',
        createdAt: { gte: start, lte: end }
      },
      select: {
        id: true,
        duration: true,
        providerId: true,
        bookerId: true,
        slot: { select: { category: true } }
      }
    });

    const totalMinutes = bookings.reduce((s, b) => s + (b.duration || 0), 0);
    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    // Carbon saved proxy: transport/moving bookings → 0.06 kg/minute (~3.6 kg/hour)
    const carbonMinutes = bookings.filter(b => ['TRANSPORT', 'MOVING'].includes((b.slot?.category as any) || '')).reduce((s, b) => s + (b.duration || 0), 0);
    const carbonSavedKg = Math.round(carbonMinutes * 0.06 * 10) / 10;

    // Top helpers by minutes provided
    const helperMap = new Map<string, number>();
    for (const b of bookings) {
      const min = b.duration || 0;
      helperMap.set(b.providerId, (helperMap.get(b.providerId) || 0) + min);
    }
    const helperEntries = Array.from(helperMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const helpers = await prisma.user.findMany({ where: { id: { in: helperEntries.map(([id]) => id) } }, select: { id: true, name: true } });
    const helpersOut = helperEntries.map(([id, minutes]) => ({ id, name: helpers.find(h => h.id === id)?.name || 'Member', minutes, hours: Math.round((minutes/60)*10)/10 }));

    // Reciprocity score (circle-wide): ratio of debit vs credit across users in circle
    const debitAgg = await prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { circleId: params.id, fromUserId: { not: null }, type: 'DEBIT', timestamp: { gte: start, lte: end } } });
    const creditAgg = await prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { circleId: params.id, toUserId: { not: null }, type: 'CREDIT', timestamp: { gte: start, lte: end } } });
    const given = debitAgg._sum.amount || 0;
    const received = creditAgg._sum.amount || 0;
    const reciprocity = received > 0 ? Math.round((given/received)*100)/100 : 1;

    // Category mix (top 6)
    const catMap = new Map<string, number>();
    for (const b of bookings) {
      const cat = (b.slot?.category as any) || 'OTHER';
      catMap.set(cat, (catMap.get(cat) || 0) + (b.duration || 0));
    }
    const categories = Array.from(catMap.entries()).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([cat, minutes]) => ({ category: cat, minutes, hours: Math.round((minutes/60)*10)/10 }));

    return NextResponse.json({
      month: `${year}-${String(month).padStart(2,'0')}`,
      totalHours,
      totalMinutes,
      carbonSavedKg,
      helpers: helpersOut,
      reciprocity,
      categories
    });
  } catch (e) {
    console.error('Impact API error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

