import express from "express";
import cors from "cors";
import morgan from "morgan";

import userRouter from "../src/routes/user/user.router.ts";
import deckRouter from "../src/routes/deck/deck.router.ts";
import cardRouter from "../src/routes/card/card.router.ts";
import reviewRouter from "../src/routes/review/review.router.ts";
import { errorHandler } from "../src/middlewares/errorHandler.ts";

var app = express();
var corsOptions = {
  origin: "http://localhost:3000",
};

app.use(cors(corsOptions));
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
