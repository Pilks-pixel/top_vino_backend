import type { Request, Response } from "express";
import {
  readUserByID,
  readUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../../services/user.service.ts";
import type { User } from "../../utils/userSchema.ts";
import { catchAsync } from "../../utils/catchAsync.ts";

export const httpGetUsers = catchAsync(async (_req: Request, res: Response) => {
  const users = await readUsers();
  res.status(200).json({ success: true, data: users });
});

export const httpGetCurrentUser = catchAsync(
  async (req: Request, res: Response) => {
    const user = await readUserByID(req.user.id);

    res.status(200).json({
      success: true,
      data: user,
    });
  },
);

export const httpGetUserByID = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await readUserByID(id);
    res.status(200).json({ success: true, data: user });
  },
);
// With Better Auth, is this route redundant?
export const httpCreateUser = catchAsync(
  async (req: Request, res: Response) => {
    const newUser: User = req.body;
    const createdUser = await createUser(newUser);
    res.status(201).json({ success: true, data: createdUser });
  },
);

export const httpUpdateUser = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const userData: Partial<User> = req.body;
    const updatedUser = await updateUser(id, userData);
    res.status(200).json({ success: true, data: updatedUser });
  },
);

export const httpDeleteUser = catchAsync(
  async (req: Request, res: Response) => {
    const { id } = req.params;
    const response = await deleteUser(id);
    res.status(200).json({ success: true, ...response });
  },
);
