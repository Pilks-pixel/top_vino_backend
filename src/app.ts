import express from "express";
import cors from "cors";
import morgan from "morgan";

import userRouter from "../src/routes/user/user.router.ts";
import { errorHandler } from "../src/middlewares/errorHandler.ts";

var app = express();
var corsOptions = {
  origin: "http://localhost:3000",
};

app.use(cors(corsOptions));
app.use(morgan("combined"));
app.use(express.json());

app.get("/", async (req, res) => {
  // await main();

  res.send("Hello World!");
});

app.use("/user", userRouter);
app.use(errorHandler);

export default app;
