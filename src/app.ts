import express from "express";
import cors from "cors";
import morgan from "morgan";

var app = express();
var corsOptions = {
  origin: "http://localhost:3000",
};

app.use(cors(corsOptions));
app.use(morgan("combined"));
app.use(express.json());
app.get("/", (req, res) => {
  res.send("Hello World!");
});

export default app;