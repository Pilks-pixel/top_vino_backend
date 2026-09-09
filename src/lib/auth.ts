import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { customSession, openAPI } from "better-auth/plugins";
import prisma from "./prisma.ts";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  // better-auth's own logger stays disabled: authentication failures are
  // reported through the app's protected request logger in app.ts.
  logger: { disabled: true },
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
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
