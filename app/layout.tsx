import type { Metadata } from "next";
import { Inter, Inter_Tight, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import SessionProviderRoot from "@/components/providers/session-provider";
import { UserMenu } from "@/components/auth/UserMenu";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Inter Display (headlines) → use Inter Tight family
const interDisplay = Inter_Tight({
  variable: "--font-inter-display",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FavorBank",
  description: "A simple favor marketplace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${interDisplay.variable} ${geistMono.variable} antialiased min-h-screen`}
      >
        <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto container-page px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md bg-[--brand-600]"></div>
              <span className="font-[family:var(--font-inter-display)] text-[15px] sm:text-base font-semibold tracking-tight">
                FavorBank
              </span>
            </div>
            <nav className="flex items-center gap-3 text-sm text-muted-foreground">
              <a className="hover:text-foreground" href="#features">Features</a>
              <a className="hover:text-foreground" href="#pricing">Pricing</a>
              <a className="hover:text-foreground" href="#about">About</a>
              <a className="hover:text-foreground" href="/brand">Brand</a>
            </nav>
            <div className="ml-4"><UserMenu /></div>
          </div>
        </header>
        <SessionProviderRoot>
          <main className="container mx-auto container-page px-4">
            {children}
          </main>
        </SessionProviderRoot>
        <Analytics />
      </body>
    </html>
  );
}
