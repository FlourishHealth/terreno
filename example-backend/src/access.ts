import {createAccess, OwnerScope, terrenoStatements} from "@terreno/api";
import mongoose from "mongoose";

import {User} from "./models/user";

export const appStatements = {
  ...terrenoStatements,
  todo: ["create", "read", "update", "delete", "list"],
} as const;

export const access = createAccess({
  connection: mongoose.connection,
  defaultRoles: [
    {
      displayName: "Manager",
      name: "manager",
      permissions: {
        todo: ["create", "read", "update", "list"],
      },
    },
  ],
  scopes: {
    "todo.delete": OwnerScope(),
    "todo.list": OwnerScope(),
    "todo.read": OwnerScope(),
    "todo.update": OwnerScope(),
  },
  statements: appStatements,
  userModel: User as unknown as import("@terreno/api").UserModel,
});
