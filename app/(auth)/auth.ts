// app/(auth)/auth.ts
// Single-password Credentials provider for shared-access demo auth (Metis v1).
// No DB session storage — JWT strategy with JWE cookies.

import { randomUUID } from "node:crypto";
import NextAuth, { type DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";

// In v1 every authenticated user is "regular"; guest access is removed.
export type UserType = "regular";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      type: UserType;
    } & DefaultSession["user"];
  }

  interface User {
    id?: string;
    email?: string | null;
    type: UserType;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    type: UserType;
  }
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Credentials({
      name: "Metis",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      authorize(credentials) {
        const password = String(credentials?.password ?? "");
        if (!password || password !== process.env.APP_PASSWORD) {
          return null;
        }
        return {
          id: randomUUID(),
          name: "Metis user",
          email: "session@metis.local",
          type: "regular" as UserType,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: SESSION_TTL_SECONDS,
    updateAge: 60 * 60, // roll cookie hourly
  },
  cookies: {
    sessionToken: {
      name: "metis.session",
      options: {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    },
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.type = (user as { type: UserType }).type;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.type = token.type;
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.AUTH_SECRET,
  basePath: "/api/auth",
  trustHost: true,
});
