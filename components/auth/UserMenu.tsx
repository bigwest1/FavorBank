"use client";
import * as React from "react";
import { useSession, signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { PlusBadge } from "@/components/plus/PlusBadge";
import Link from "next/link";

export function UserMenu() {
  const { data } = useSession();
  const user = data?.user;
  const [isPlusUser, setIsPlusUser] = React.useState(false);
  
  React.useEffect(() => {
    if (user?.id) {
      // Check Plus status
      fetch(`/api/users/${user.id}/plus-status`)
        .then(res => res.ok ? res.json() : null)
        .then(data => setIsPlusUser(data?.isActive || false))
        .catch(() => setIsPlusUser(false));
    }
  }, [user?.id]);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link className="hover:text-foreground" href="/login">Login</Link>
        <Link className="hover:text-foreground" href="/signup">Sign up</Link>
      </div>
    );
  }
  const initials = (user.name ?? user.email ?? "?").slice(0, 2).toUpperCase();
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="outline-none">
        <div className="relative">
          <Avatar>
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          {isPlusUser && <PlusBadge variant="crown" size="sm" />}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {isPlusUser && (
          <>
            <div className="px-2 py-1">
              <PlusBadge size="sm" />
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link href="/app">Dashboard</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/profile">Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/app/settings">Settings</Link>
        </DropdownMenuItem>
        {isPlusUser && (
          <DropdownMenuItem asChild>
            <Link href="/app/plus">Plus Benefits</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>Logout</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserMenu;

