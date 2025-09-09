import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AppDashboard() {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;
  let balance = 0;
  let recent: { id: string; amount: number; meta: any; createdAt: Date }[] = [];
  if (userId) {
    const memberships = await prisma.membership.findMany({ where: { userId } });
    balance = memberships.reduce((sum, m) => sum + (m.balanceCredits ?? 0), 0);
    recent = await prisma.ledgerEntry.findMany({
      where: { OR: [{ fromUserId: userId }, { toUserId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, amount: true, meta: true, createdAt: true },
    });
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="text-sm text-muted-foreground">Total credits</div>
          <div className="mt-2 text-h1">{balance}</div>
          <p className="mt-2 text-sm text-muted-foreground">Tip: Post your first 2 micro-slots—5 minutes each.</p>
        </Card>
        <Card className="p-6 md:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-h3">Recent activity</h2>
            <Button variant="outline" size="sm">View all</Button>
          </div>
          {recent.length === 0 ? (
            <div className="mt-6 flex items-center gap-4">
              <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
                <circle cx="32" cy="32" r="30" fill="var(--cloud)" stroke="var(--clay)" />
                <path d="M20 36h24M20 28h24" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <div>
                <div className="text-sm font-medium">No activity yet</div>
                <div className="text-sm text-muted-foreground">Earn credits by helping or buy a small pack to get started.</div>
              </div>
            </div>
          ) : (
            <ul className="mt-4 space-y-2 text-sm">
              {recent.map((r) => (
                <li key={r.id} className="flex items-center justify-between border-b pb-2">
                  <span className="truncate text-muted-foreground">{r.meta?.kind ?? "entry"}</span>
                  <span className="font-medium">{r.amount}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-4">
          <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden>
            <rect x="10" y="20" width="60" height="40" rx="8" fill="var(--cloud)" stroke="var(--clay)" />
            <circle cx="26" cy="40" r="8" fill="var(--leaf-42a)" />
            <circle cx="54" cy="40" r="8" fill="var(--citrus)" />
          </svg>
          <div>
            <div className="text-h3">Ready to trade?</div>
            <p className="text-muted-foreground">Post two 5-minute micro-slots—friends can book and you’ll earn quickly.</p>
          </div>
          <div className="ml-auto">
            <Link href="/app/slotshop">
              <Button variant="brand">Visit SlotShop</Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
