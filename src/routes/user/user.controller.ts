import express from "express";
import {
  readUser,
  readUserByID,
  readUsers,
  createUser,
  updateUser,
  deleteUser,
} from "../../services/user.service";
import type { User } from "../../model/usersModel";

async function httpGetUsers(req: express.Request, res: express.Response) {
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
async function httpGetUserByEmail(req: express.Request, res: express.Response) {
  const email = req.params.email;

  try {
    const user = await readUser(email);
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to retrieve user",
    });
  }
}
async function httpGetUserByID(req: express.Request, res: express.Response) {
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
async function httpCreateUser(req: express.Request, res: express.Response) {
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

async function httpUpdateUser(req: express.Request, res: express.Response) {
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

async function httpDeleteUser(req: express.Request, res: express.Response) {
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
