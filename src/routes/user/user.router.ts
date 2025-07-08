import express from "express";

import {
  httpGetUsers,
  httpGetUserByEmail,
  httpGetUserByID,
  httpCreateUser,
  httpUpdateUser,
  httpDeleteUser,
} from "./user.controller.ts";

import User from "../../utils/userSchema.ts";
import validationMiddleware from "../../middlewares/validationMiddleware.ts";

const userRouter = express.Router();

userRouter.get("/", httpGetUsers);
userRouter.get("/:email", httpGetUserByEmail);
userRouter.get("/:id", httpGetUserByID);
userRouter.post("/", validationMiddleware(User), httpCreateUser);
userRouter.put("/:id", validationMiddleware(User), httpUpdateUser);
userRouter.delete("/:id", httpDeleteUser);

export default userRouter;
