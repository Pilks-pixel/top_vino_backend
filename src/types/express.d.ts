import "express";

declare global {
  namespace Express {
    interface Request {
      user: {
        id: string;
        email: string;
        subscriptionType: "FREE" | "PRO";
      };
    }
  }
}

export {};
