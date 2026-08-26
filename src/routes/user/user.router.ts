import express from "express";

import {
  httpGetUserByID,
  httpUpdateUser,
  httpDeleteUser,
  httpGetCurrentUser,
} from "./user.controller.ts";

import { UserUpdate } from "../../utils/userSchema.ts";
import { authMiddleware } from "../../middlewares/authMiddleware.ts";
import { requireOwnership } from "../../middlewares/requireOwnership.ts";
import validationMiddleware from "../../middlewares/validationMiddleware.ts";

const userRouter = express.Router();

userRouter.get("/me", authMiddleware, httpGetCurrentUser);
userRouter.get("/:id", authMiddleware, httpGetUserByID);
userRouter.put(
  "/:id",
  authMiddleware,
  requireOwnership(req => req.params.id),
  validationMiddleware(UserUpdate),
  httpUpdateUser,
);
userRouter.delete(
  "/:id",
  authMiddleware,
  requireOwnership(req => req.params.id),
  httpDeleteUser,
);

export default userRouter;
