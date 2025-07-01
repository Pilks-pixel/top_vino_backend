import express from "express";

import { addUser, getAllUsers } from "../../model/usersModel";
import type { User } from "../../model/usersModel";

function httpGetUsers(req: express.Request, res: express.Response) {
  const users = getAllUsers();
  res.status(200).json(users);
  return;
}

function httpAddUser(req: express.Request, res: express.Response) {
  const newUser: User = req.body;

  if (!newUser.email || !newUser.name || !newUser.subscription_type) {
    return res.status(400).json({ error: "Missing required user data" });
  }

  addUser(newUser);
  res.status(201).json(newUser);
  return;
}

export { httpGetUsers, httpAddUser };
