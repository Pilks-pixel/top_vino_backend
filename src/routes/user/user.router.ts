import express from "express";

import {
  httpGetUserByID,
  httpUpdateUser,
  httpDeleteUser,
  httpGetCurrentUser,
} from "./user.controller.ts";

import { UserUpdateSchema } from "../../utils/userSchema.ts";
import { authMiddleware } from "../../middlewares/authMiddleware.ts";
import { requireOwnership } from "../../middlewares/requireOwnership.ts";
import validationMiddleware from "../../middlewares/validationMiddleware.ts";
import { UserIdParamsSchema } from "../../utils/paramsSchema.ts";

const userRouter = express.Router();

userRouter.get("/me", authMiddleware, httpGetCurrentUser);
userRouter.get(
  "/:id",
  authMiddleware,
  validationMiddleware(UserIdParamsSchema, "params"),
  httpGetUserByID,
);
userRouter.put(
  "/:id",
  authMiddleware,
  validationMiddleware(UserIdParamsSchema, "params"),
  requireOwnership(req => req.params.id),
  validationMiddleware(UserUpdateSchema),
  httpUpdateUser,
);
userRouter.delete(
  "/:id",
  authMiddleware,
  validationMiddleware(UserIdParamsSchema, "params"),
  requireOwnership(req => req.params.id),
  httpDeleteUser,
);

export default userRouter;
