import type { Request, Response, NextFunction } from "express";
import {
  readUser,
  readUserByID,
  readUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../../services/user.service.ts";
import type User from "../../utils/userSchema.ts";

async function httpGetUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const users = await readUsers();
    res.status(200).json(users);
  } catch (error) {
    next(error);
  }
}

async function httpGetUserByEmail(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { email } = req.params;

  try {
    const user = await readUser(email);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}
async function httpGetUserByID(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const { id } = req.params;

  try {
    const user = await readUserByID(id);
    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}
async function httpCreateUser(req: Request, res: Response, next: NextFunction) {
  const newUser: User = req.body;

  try {
    const createdUser = await createUser(newUser);
    res.status(201).json(createdUser);
  } catch (error) {
    next(error);
  }

  return;
}

async function httpUpdateUser(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;
  const userData: Partial<User> = req.body;

  try {
    const updatedUser = await updateUser(id, userData);
    res.status(200).json(updatedUser);
  } catch (error) {
    next(error);
  }
}

async function httpDeleteUser(req: Request, res: Response, next: NextFunction) {
  const { id } = req.params;

  try {
    const response = await deleteUser(id);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
}

export {
  httpGetUsers,
  httpGetUserByEmail,
  httpGetUserByID,
  httpCreateUser,
  httpUpdateUser,
  httpDeleteUser,
};
