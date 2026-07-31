import express from "express";
import cors from "cors";
import morgan from "morgan";
import { toNodeHandler } from "better-auth/node";

import { auth } from "../src/lib/auth.ts";
import userRouter from "../src/routes/user/user.router.ts";
import deckRouter from "../src/routes/deck/deck.router.ts";
import cardRouter from "../src/routes/card/card.router.ts";
import reviewRouter from "../src/routes/review/review.router.ts";
import { errorHandler } from "../src/middlewares/errorHandler.ts";

var app = express();

app.all("/api/auth/{*any}", toNodeHandler(auth));
app.use(
  cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:3000",
    credentials: true,
  }),
);
app.use(morgan("combined"));
app.use(express.json());

app.get("/", async (_req, res) => {
  res.send("Hello World!");
});

app.use("/user", userRouter);
app.use("/deck", deckRouter);
app.use("/deck/:deckId/cards", cardRouter);
app.use("/review", reviewRouter);
app.use(errorHandler);

export default app;
