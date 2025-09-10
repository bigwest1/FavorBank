import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // Basic guard: allow only in development or when explicitly opted-in
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_SEED !== 'true') {
      return NextResponse.json({ error: 'Seeding disabled in production' }, { status: 403 });
    }

    const pw = await bcrypt.hash('password123', 10);

    // Users
    const alice = await prisma.user.upsert({
      where: { email: 'alice@example.com' },
      update: {},
      create: { email: 'alice@example.com', name: 'Alice Helper', passwordHash: pw }
    });
    const bob = await prisma.user.upsert({
      where: { email: 'bob@example.com' },
      update: {},
      create: { email: 'bob@example.com', name: 'Bob Asker', passwordHash: pw }
    });

    // Circles
    const c1 = await prisma.circle.create({
      data: { name: 'Downtown Neighbors', description: 'Central hub for quick help', ownerId: alice.id, isActive: true }
    });
    const c2 = await prisma.circle.create({
      data: { name: 'Makers & Fixers', description: 'DIY, repairs, and tools', ownerId: bob.id, isActive: true }
    });

    // Memberships
    await prisma.membership.createMany({ data: [
      { userId: alice.id, circleId: c1.id, role: 'OWNER', balanceCredits: 200 },
      { userId: bob.id, circleId: c1.id, role: 'MEMBER', balanceCredits: 150 },
      { userId: bob.id, circleId: c2.id, role: 'OWNER', balanceCredits: 200 },
      { userId: alice.id, circleId: c2.id, role: 'MEMBER', balanceCredits: 120 },
    ]});

    // Treasuries + initial funding
    const t1 = await prisma.circleTreasury.upsert({ where: { circleId: c1.id }, update: {}, create: { circleId: c1.id, currentBalance: 1000, isMatchingActive: true, matchRatio: 1 } });
    const t2 = await prisma.circleTreasury.upsert({ where: { circleId: c2.id }, update: {}, create: { circleId: c2.id, currentBalance: 800 } });
    await prisma.treasuryFunding.createMany({ data: [
      { treasuryId: t1.id, amountCents: 50000, creditAmount: 500, conversionRate: 100, status: 'COMPLETED', processedAt: new Date(), notes: 'Sponsor: Local Co-op' },
      { treasuryId: t2.id, amountCents: 30000, creditAmount: 300, conversionRate: 100, status: 'COMPLETED', processedAt: new Date(), notes: 'Sponsor: Makerspace' },
    ]});

    // Pro profile for Alice
    await prisma.proProfile.upsert({ where: { userId: alice.id }, update: { status: 'APPROVED', backgroundCheckPassed: true }, create: { userId: alice.id, status: 'APPROVED', backgroundCheckPassed: true } });

    // Plus subscription for Bob
    const end = new Date(); end.setMonth(end.getMonth() + 1);
    await prisma.plusSubscription.upsert({ where: { userId: bob.id }, update: { status: 'ACTIVE', currentPeriodEnd: end }, create: { userId: bob.id, status: 'ACTIVE', currentPeriodEnd: end } });

    // Example requests in c1 (Bob asks), slots in c1 (Alice provides)
    const now = new Date();
    const in1h = new Date(now.getTime() + 60*60*1000);
    const in2h = new Date(now.getTime() + 2*60*60*1000);
    // Request (if model exists)
    try {
      await prisma.request.create({
        data: {
          circleId: c1.id,
          userId: bob.id,
          title: 'Quick help moving a desk',
          description: 'Need a hand to move a desk across the room',
          status: 'OPEN',
          category: 'MOVING_HELP',
          effortLevel: 3,
          creditsOffered: 60,
          tier: 'PRIORITY',
          timeWindowStart: in1h,
          timeWindowEnd: in2h,
        }
      });
    } catch { /* Request model may not exist in this schema */ }

    // Slots by Alice in c1
    await prisma.slot.createMany({ data: [
      { circleId: c1.id, providerId: alice.id, title: 'Quick tech support', description: 'Printer, Wi‑Fi, apps', category: 'TECH_SUPPORT', start: in1h, end: in2h, pricePerMinute: 2, minDuration: 30, status: 'OPEN' },
      { circleId: c1.id, providerId: alice.id, title: 'Ride share to co‑op', description: '3pm ride downtown', category: 'TRANSPORT', start: new Date(now.getTime() + 3*60*60*1000), end: new Date(now.getTime() + 4*60*60*1000), pricePerMinute: 1, minDuration: 20, status: 'OPEN' }
    ]});

    return NextResponse.json({
      success: true,
      users: { alice: alice.email, bob: bob.email },
      circles: [c1.id, c2.id],
      note: 'Passwords for demo users: password123'
    });
  } catch (e) {
    console.error('Seed error:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

