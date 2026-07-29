import express from "express";

import {
  httpGetUsers,
  httpGetUserByID,
  httpUpdateUser,
  httpDeleteUser,
  httpGetCurrentUser,
} from "./user.controller.ts";

import { User } from "../../utils/userSchema.ts";
import { authMiddleware } from "../../middlewares/authMiddleware.ts";
import { requireOwnership } from "../../middlewares/requireOwnership.ts";
import validationMiddleware from "../../middlewares/validationMiddleware.ts";

const userRouter = express.Router();

userRouter.get("/", httpGetUsers);
userRouter.get("/:id", httpGetUserByID);
userRouter.get("/me", authMiddleware, httpGetCurrentUser);
userRouter.put(
  "/:id",
  authMiddleware,
  requireOwnership(req => req.params.id),
  validationMiddleware(User),
  httpUpdateUser,
);
userRouter.delete(
  "/:id",
  authMiddleware,
  requireOwnership(req => req.params.id),
  httpDeleteUser,
);

export default userRouter;
