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

async function httpGetUsers(req: Request, res: Response) {
  try {
    const users = await readUsers();
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error ? error.message : "Failed to retrieve users",
    });
  }
}
async function httpGetUserByEmail(req: Request, res: Response) {
  const { email } = req.params;

  try {
    const user = await readUser(email);
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to retrieve user",
    });
  }
}
async function httpGetUserByID(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const user = await readUserByID(id);
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to retrieve user",
    });
  }
}
async function httpCreateUser(req: Request, res: Response) {
  const newUser: User = req.body;

  try {
    const createdUser = await createUser(newUser);
    res.status(201).json(createdUser);
  } catch (error) {
    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : `Failed to add user ${newUser.name}`,
    });
  }

  return;
}

async function httpUpdateUser(req: Request, res: Response) {
  const { id } = req.params;
  const userData: Partial<User> = req.body;

  try {
    const updatedUser = await updateUser(id, userData);
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to update user",
    });
  }
}

async function httpDeleteUser(req: Request, res: Response) {
  const { id } = req.params;

  try {
    const response = await deleteUser(id);
    res.status(200).json(response);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to delete user",
    });
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
