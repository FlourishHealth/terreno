import express from "express";
import mongoose, {model, Schema} from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";

import {modelRouter, type modelRouterOptions} from "./api";
import {addAuthRoutes, setupAuth} from "./auth";
import {setupServer} from "./expressServer";
import {logger} from "./logger";
import {Permissions} from "./permissions";
import {baseUserPlugin, createdUpdatedPlugin} from "./plugins";

mongoose
  .connect("mongodb://localhost:27017/example")
  .then(() => {
    logger.debug("Connected to mongo");
  })
  .catch((err) => {
    logger.error(`Error connecting to mongo ${err}`);
  });

interface User {
  admin: boolean;
  username: string;
}

interface Food {
  name: string;
  calories: number;
  created: Date;
  ownerId: mongoose.Types.ObjectId | User;
  hidden?: boolean;
}

const userSchema = new Schema<User>({
  admin: {default: false, type: Boolean},
  username: String,
});

userSchema.plugin(passportLocalMongoose as any, {usernameField: "email"});
userSchema.plugin(createdUpdatedPlugin);
userSchema.plugin(baseUserPlugin);
const UserModel = model<User>("User", userSchema);

const schema = new Schema<Food>({
  calories: Number,
  created: Date,
  hidden: {default: false, type: Boolean},
  name: String,
  ownerId: {ref: "User", type: "ObjectId"},
});

const FoodModel = model<Food>("Food", schema);

function getBaseServer() {
  const app = express();

  app.all("/*", (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    // intercepts OPTIONS method
    if (req.method === "OPTIONS") {
      res.send(200);
    } else {
      next();
    }
  });
  app.use(express.json());
  setupAuth(app, UserModel as any);
  addAuthRoutes(app, UserModel as any);

  function addRoutes(router: express.Router, options?: Partial<modelRouterOptions<any>>): void {
    router.use(
      "/food",
      modelRouter(FoodModel, {
        ...options,
        openApiOverwrite: {
          get: {responses: {200: {description: "Get all the food"}}},
        },
        permissions: {
          create: [Permissions.IsAuthenticated],
          delete: [Permissions.IsAdmin],
          list: [Permissions.IsAny],
          read: [Permissions.IsAny],
          update: [Permissions.IsOwner],
        },
        queryFields: ["name", "calories", "created", "ownerId", "hidden"],
      })
    );
  }

  return setupServer({
    addRoutes,
    loggingOptions: {
      level: "debug",
    },
    userModel: UserModel as any,
  });
}
getBaseServer();
