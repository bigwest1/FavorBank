"use server";
import { ReactNode } from "react";
import { auth } from "@/auth";
import { SessionProvider } from "next-auth/react";

export default async function SessionProviderRoot({ children }: { children: ReactNode }) {
  const session = await auth();
  // @ts-expect-error - next-auth types mismatch for server usage
  return <SessionProvider session={session}>{children}</SessionProvider>;
}

