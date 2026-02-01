import type { Request, Response } from "express";
import {
  readUser,
  readUserByID,
  readUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../../services/user.service.ts";
import type User from "../../utils/userSchema.ts";
import { catchAsync } from "../../utils/catchAsync.ts";

const httpGetUsers = catchAsync(async (_req: Request, res: Response) => {
  const users = await readUsers();
  res.status(200).json({ success: true, data: users });
});

const httpGetUserByEmail = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.params;
  const user = await readUser(email);
  res.status(200).json({ success: true, data: user });
});

const httpGetUserByID = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const user = await readUserByID(id);
  res.status(200).json({ success: true, data: user });
});

const httpCreateUser = catchAsync(async (req: Request, res: Response) => {
  const newUser: User = req.body;
  const createdUser = await createUser(newUser);
  res.status(201).json({ success: true, data: createdUser });
});

const httpUpdateUser = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const userData: Partial<User> = req.body;
  const updatedUser = await updateUser(id, userData);
  res.status(200).json({ success: true, data: updatedUser });
});

const httpDeleteUser = catchAsync(async (req: Request, res: Response) => {
  const { id } = req.params;
  const response = await deleteUser(id);
  res.status(200).json({ success: true, ...response });
});

export {
  httpGetUsers,
  httpGetUserByEmail,
  httpGetUserByID,
  httpCreateUser,
  httpUpdateUser,
  httpDeleteUser,
};
