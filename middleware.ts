import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // For now, we'll skip middleware auth checks since they cause Edge runtime issues
  // Auth checks will happen at the page level instead
  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*"],
};

