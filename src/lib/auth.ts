import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { customSession, openAPI } from "better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { makeSignature } from "better-auth/crypto";
import prisma from "./prisma.ts";
import { authSecretOptions } from "../config/authSecrets.ts";

const signing = authSecretOptions();
const sandbox = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  // better-auth's own logger stays disabled: authentication failures are
  // reported through the app's protected request logger in app.ts.
  logger: { disabled: true },
  ...signing,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    disableSignUp: sandbox,
  },
  socialProviders:
    !sandbox && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          },
        }
      : {},
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      // Revocation must take effect immediately, including for browsers still
      // holding all cookies. Production reads the authoritative session store.
      enabled: !sandbox,
      maxAge: 5 * 60,
    },
  },
  hooks: {
    before: createAuthMiddleware(async ctx => {
      if (!signing.secrets || !ctx.headers) return;
      const [current, ...previous] = signing.secrets;
      const headers = new Headers(ctx.headers);
      let sessionToken: string | undefined;
      // better-auth@1.6.23 uses versioned keys for encryption, but verifies
      // opaque session-cookie signatures with only the current key. Verify
      // old cookies through its own cookie API, then present a current-key
      // signature to the normal handler. Database lookup and expiry still
      // decide authorization; every newly issued cookie uses the current key.
      for (const { name } of [
        ctx.context.authCookies.sessionToken,
        ctx.context.authCookies.dontRememberToken,
      ]) {
        const currentToken = await ctx.getSignedCookie(name, current.value);
        if (currentToken) {
          if (name === ctx.context.authCookies.sessionToken.name)
            sessionToken = currentToken;
          continue;
        }
        for (const secret of previous) {
          const token = await ctx.getSignedCookie(name, secret.value);
          if (!token) continue;
          if (name === ctx.context.authCookies.sessionToken.name)
            sessionToken = token;
          const signature = await makeSignature(token, current.value);
          const cookie = `${name}=${encodeURIComponent(`${token}.${signature}`)}`;
          headers.set(
            "cookie",
            (headers.get("cookie") ?? "")
              .split(";")
              .map(part => (part.trim().startsWith(`${name}=`) ? cookie : part))
              .join(";"),
          );
          break;
        }
      }
      if (
        sandbox &&
        sessionToken &&
        !["/sign-in/email", "/sign-out"].includes(ctx.path)
      ) {
        const session = await prisma.session.findUnique({
          where: { token: sessionToken },
          select: {
            userId: true,
            user: {
              select: {
                accounts: {
                  where: { providerId: "credential", password: { not: null } },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        });
        // A sign-in already verifying a password can mint a session after the
        // operator removes credentials. Such a session must never authorize
        // product work or Better Auth's own session-management endpoints.
        if (session && session.user.accounts.length === 0) {
          await prisma.session.deleteMany({
            where: { userId: session.userId },
          });
          throw new APIError("UNAUTHORIZED", {
            message: "Unauthorized",
            code: "UNAUTHORIZED",
          });
        }
      }
      return { context: { headers } };
    }),
  },
  plugins: [
    openAPI({ disableDefaultReference: true }),
    customSession(async ({ user, session }) => {
      const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
      if (!dbUser)
        throw new Error(`Session references unknown user: ${user.id}`);
      return {
        ...session,
        user: { ...user, subscriptionType: dbUser.subscriptionType },
      };
    }),
  ],
});
