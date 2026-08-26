import type { Request, Response } from "express";
import {
  readUserByID,
  updateUser,
  deleteUser,
} from "../../services/user.service.ts";
import type { UserProfile, UserUpdate } from "../../utils/userSchema.ts";
import { catchAsync } from "../../utils/catchAsync.ts";

function toUserProfile(user: {
  id: string;
  name: string | null;
  email: string;
  subscriptionType: string;
}): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    subscriptionType: user.subscriptionType as UserProfile["subscriptionType"],
  };
}

export const httpGetCurrentUser = catchAsync(
  async (req: Request, res: Response) => {
    const user = await readUserByID(req.user.id);

    res.status(200).json({
      success: true,
      data: toUserProfile(user),
    });
  },
);

export const httpGetUserByID = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await readUserByID(id);
    res.status(200).json({ success: true, data: toUserProfile(user) });
  },
);

export const httpUpdateUser = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const userData: UserUpdate = req.body;
    const updatedUser = await updateUser(id, userData);
    res.status(200).json({
      success: true,
      data: toUserProfile(updatedUser),
    });
  },
);

export const httpDeleteUser = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const response = await deleteUser(id);
    res.status(200).json({ success: true, ...response });
  },
);
