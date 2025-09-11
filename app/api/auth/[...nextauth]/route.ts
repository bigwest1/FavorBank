// Avoid importing NextAuth handlers at module load time to prevent build-time
// crashes when env vars are missing. Lazily import on request.
export async function GET(req: Request, ctx: any) {
  const { handlers } = await import("@/auth");
  // @ts-expect-error: NextAuth handler types
  return handlers.GET(req as any, ctx as any);
}

export async function POST(req: Request, ctx: any) {
  const { handlers } = await import("@/auth");
  // @ts-expect-error: NextAuth handler types
  return handlers.POST(req as any, ctx as any);
}
