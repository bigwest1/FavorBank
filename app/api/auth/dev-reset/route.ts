import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const ResetSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(8),
});

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" && process.env.AUTH_DEV_RESET !== "1") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }
  try {
    const json = await req.json();
    const data = ResetSchema.parse(json);
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) return NextResponse.json({ error: "No user" }, { status: 404 });
    const passwordHash = await hashPassword(data.newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message ?? "Invalid input" }, { status: 400 });
  }
}

