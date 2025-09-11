"use client";
import { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";

export default function SessionProviderRoot({ children }: { children: ReactNode }) {
  // Client-only provider; session will be fetched on the client.
  return <SessionProvider>{children}</SessionProvider>;
}
