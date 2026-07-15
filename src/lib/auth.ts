import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { customSession } from "better-auth/plugins";
import { PrismaClient } from "../../generated/prisma/index.js";

type BetterAuthResponseContext = {
  context: {
    returned?: Response;
  };
};

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
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
  onAPIError: {
    onError: (error, ctx) => {
      const apiError = error as { message: string; status?: number };
      console.error("[AUTH ERROR]", apiError.message);
      const authCtx = ctx as unknown as BetterAuthResponseContext;

      authCtx.context.returned = new Response(
        JSON.stringify({
          success: false,
          status: "error",
          statusCode: apiError.status ?? 500,
          message: apiError.message,
        }),
        {
          status: apiError.status ?? 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    },
  },
});
