import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const now = new Date();
    const tomorrowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
    const tomorrowEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 23, 59, 59);

    // Count upcoming public slots in user's circles tomorrow
    const memberships = await prisma.membership.findMany({ where: { userId: user.id }, select: { circleId: true } });
    const circleIds = memberships.map(m => m.circleId);
    const favorsTomorrow = await prisma.slot.count({
      where: {
        circleId: { in: circleIds },
        start: { gte: tomorrowStart, lte: tomorrowEnd },
        status: 'OPEN'
      }
    });

    // Reciprocity glance (simplified): difference between given vs received based on ledger entries
    const given = await prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { fromUserId: user.id, type: 'DEBIT' } });
    const received = await prisma.ledgerEntry.aggregate({ _sum: { amount: true }, where: { toUserId: user.id, type: 'CREDIT' } });
    const ratio = (received._sum.amount || 0) > 0 ? (given._sum.amount || 0) / (received._sum.amount || 1) : 1;
    const reciprocityMsg = ratio >= 0.8 && ratio <= 1.2 ? 'Your reciprocity is glowing ✨' : undefined;

    const subject = `${favorsTomorrow} favors near you tomorrow`;
    const body = {
      greeting: `Hi ${user.name || 'there'},`,
      summary: `${favorsTomorrow} favors are available tomorrow in your circles.`,
      reciprocity: reciprocityMsg,
      cta: 'Open FavorBank to browse and book',
    };

    console.log('[Digest Email]', { to: session.user.email, subject, body });

    return NextResponse.json({ success: true, preview: { subject, body } });
  } catch (e) {
    console.error('Digest test error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

