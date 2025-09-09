import { ReactNode } from "react";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import Logo from "@/components/brand/Logo";
import { Bell, CircleDollarSign } from "lucide-react";
import { UserMenu } from "@/components/auth/UserMenu";
import { cn } from "@/lib/utils";

export default async function AppShellLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const userId = session?.user?.id as string | undefined;

  let balance = 0;
  let unread = 0;
  if (userId) {
    const [memberships, notifications] = await Promise.all([
      prisma.membership.findMany({ where: { userId } }),
      prisma.notification.count({ where: { userId, read: false } }),
    ]);
    balance = memberships.reduce((sum, m) => sum + (m.balanceCredits ?? 0), 0);
    unread = notifications;
  }

  const NavLink = ({ href, children }: { href: string; children: ReactNode }) => (
    <Link
      href={href}
      className={cn(
        "px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent"
      )}
    >
      {children}
    </Link>
  );

  return (
    <div className="min-h-[calc(100vh-3.5rem)]">
      <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto container-page px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo />
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground">
              <CircleDollarSign className="size-4" />
              <span>Credits</span>
              <span className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-foreground bg-cloud" style={{ borderColor: "var(--clay)"}}>
                {balance}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/app/notifications" className="relative text-muted-foreground hover:text-foreground">
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center rounded-full bg-[var(--leaf-42a)] text-white text-[10px] h-4 min-w-4 px-1">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </Link>
            <UserMenu />
          </div>
        </div>
        <div className="border-t">
          <nav className="container mx-auto container-page px-2 sm:px-4 flex gap-1 overflow-x-auto">
            <NavLink href="/app">Dashboard</NavLink>
            <NavLink href="/app/circles">Circles</NavLink>
            <NavLink href="/app/map">Map</NavLink>
            <NavLink href="/app/calendar">Calendar</NavLink>
            <NavLink href="/app/treasury">Treasury</NavLink>
            <NavLink href="/app/pro">Pro</NavLink>
          </nav>
        </div>
      </header>
      <main className="container mx-auto container-page px-4 py-6">{children}</main>
    </div>
  );
}

