import type { Metadata } from "next";
import { Inter, Inter_Tight, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/react";
import SessionProviderRoot from "@/components/providers/session-provider";
import { UserMenu } from "@/components/auth/UserMenu";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider, defaultDict } from "@/lib/i18n";

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

// Ensure root layout is rendered dynamically to avoid build-time prerender
// issues when environment or session context isn't available.
export const dynamic = "force-dynamic";

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
          <I18nProvider dict={defaultDict}>
            <main className="container mx-auto container-page px-4">
              {children}
            </main>
            <footer className="border-t mt-12">
              <div className="container mx-auto container-page px-4 py-8 text-sm text-muted-foreground grid gap-4 md:grid-cols-2">
                <div>
                  <div className="font-medium text-foreground mb-2">FavorBank</div>
                  <p className="max-w-prose">A friendly, community-driven time exchange. Credits are for coordinating help — not cash.</p>
                </div>
                <nav className="flex flex-wrap gap-4 items-start justify-start md:justify-end" aria-label="Legal">
                  <a className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/legal/terms">Terms</a>
                  <a className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/legal/privacy">Privacy</a>
                  <a className="hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background" href="/legal/house-rules">House Rules</a>
                </nav>
              </div>
            </footer>
          </I18nProvider>
        </SessionProviderRoot>
        <Toaster position="top-right" richColors />
        <Analytics />
      </body>
    </html>
  );
}
