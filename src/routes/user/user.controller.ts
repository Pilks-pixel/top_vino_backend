import express from "express";
import { getUsers, createUser } from "../../services/user.service";
import type { User } from "../../model/usersModel";

async function httpGetUsers(req: express.Request, res: express.Response) {
  try {
    const users = await getUsers();
    res.status(200).json(users);
  } catch (error) {
    res
      .status(500)
      .json({
        error:
          error instanceof Error ? error.message : "Failed to retrieve users",
      });
  }
}
async function httpCreateUser(req: express.Request, res: express.Response) {
  const newUser: User = req.body;

  try {
    const createdUser = await createUser(newUser);
    res.status(201).json(createdUser);
  } catch (error) {
    res.status(500).json({ error: "Failed to add user" });
    console.log(newUser.name, "error adding user:", error);
  }

  return;
}

export { httpGetUsers, httpCreateUser };
