import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";

const CredentialsSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

let handlers: any;
let auth: any;
let signIn: any;
let signOut: any;

try {
  const configured = NextAuth({
    session: { strategy: "jwt" },
    providers: [
      Credentials({
        name: "Credentials",
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
        },
        authorize: async (credentials) => {
          const parsed = CredentialsSchema.safeParse(credentials);
          if (!parsed.success) return null;
          const { email, password } = parsed.data;
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) return null;
          const ok = await verifyPassword(password, user.passwordHash);
          if (!ok) return null;
          return {
            id: user.id,
            name: user.name ?? null,
            email: user.email,
            image: user.avatar ?? null,
          };
        },
      }),
    ],
    trustHost: true,
    secret: process.env.NEXTAUTH_SECRET,
  });
  handlers = configured.handlers;
  auth = configured.auth;
  signIn = configured.signIn;
  signOut = configured.signOut;
} catch (e) {
  // Provide safe fallbacks so build-time imports don't crash.
  handlers = {
    GET: async () => new Response(JSON.stringify({ error: "Auth not configured" }), { status: 500 }),
    POST: async () => new Response(JSON.stringify({ error: "Auth not configured" }), { status: 500 }),
  };
  auth = async () => null;
  signIn = async () => { throw new Error("Auth not configured"); };
  signOut = async () => {};
}

export { handlers, auth, signIn, signOut };
