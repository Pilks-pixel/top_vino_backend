import { createServer } from "node:http";
import dotenv from "dotenv";
dotenv.config();

import app from "./app.ts";

var port = process.env.PORT || 8000;
var server = createServer(app);

function startServer() {
  server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
startServer();