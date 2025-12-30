import express, {type Express} from "express";
import mongoose, {type Model, model, Schema} from "mongoose";
import passportLocalMongoose from "passport-local-mongoose";
import supertest from "supertest";
import type TestAgent from "supertest/lib/agent";

import {logger} from "./logger";
import {createdUpdatedPlugin, DateOnly, isDisabledPlugin} from "./plugins";

export interface User {
  admin: boolean;
  name?: string;
  username: string;
  email: string;
  age?: number;
  disabled?: boolean;
}

export interface SuperUser extends User {
  superTitle: string;
}

export interface StaffUser extends User {
  department: string;
}

export interface FoodCategory {
  _id?: string;
  name: string;
  show: boolean;
  created: Date;
  updated: Date;
}

export interface Food {
  _id: string;
  name: string;
  calories: number;
  created: Date;
  ownerId: mongoose.Types.ObjectId | User;
  hidden?: boolean;
  source: {
    name: string;
    href?: string;
    dateAdded?: string;
  };
  tags: string[];
  eatenBy: [Schema.Types.ObjectId | User];
  // We want to test that map type works.
  lastEatenWith: {[name: string]: Date};
  categories: FoodCategory[];
  expiration: string;
  likesIds: {userId: string; likes: boolean}[];
}

const userSchema = new Schema<User>({
  admin: {default: false, type: Boolean},
  age: Number,
  name: String,
  username: String,
});

userSchema.plugin(passportLocalMongoose, {
  attemptsField: "attempts",
  interval: process.env.NODE_ENV === "test" ? 1 : 100,
  limitAttempts: true,
  maxAttempts: 3,
  maxInterval: process.env.NODE_ENV === "test" ? 1 : 300000,
  usernameCaseInsensitive: true,
  usernameField: "email",
});
// userSchema.plugin(tokenPlugin);
userSchema.plugin(createdUpdatedPlugin);
userSchema.plugin(isDisabledPlugin);
userSchema.methods.postCreate = async function (body: any) {
  this.age = body.age;
  return this.save();
};

export const UserModel = model<User>("User", userSchema);

const superUserSchema = new Schema<SuperUser>({
  superTitle: {required: true, type: String},
});
export const SuperUserModel = UserModel.discriminator("SuperUser", superUserSchema);

const staffUserSchema = new Schema<StaffUser>({
  department: {required: true, type: String},
});
export const StaffUserModel = UserModel.discriminator("Staff", staffUserSchema);

const foodCategorySchema = new Schema<FoodCategory>(
  {
    name: String,
    show: Boolean,
  },
  {timestamps: {createdAt: "created", updatedAt: "updated"}}
);

const likesSchema = new Schema<any>({
  likes: Boolean,
  userId: {ref: "User", type: "ObjectId"},
});

const foodSchema = new Schema<Food>(
  {
    calories: Number,
    categories: [foodCategorySchema],
    created: Date,
    eatenBy: [
      {
        ref: "User",
        required: true,
        type: Schema.Types.ObjectId,
      },
    ],
    expiration: DateOnly,
    hidden: {default: false, type: Boolean},
    lastEatenWith: {
      of: Date,
      type: Map,
    },
    likesIds: {required: true, type: [likesSchema]},
    name: String,
    ownerId: {ref: "User", type: "ObjectId"},
    source: {
      dateAdded: String,
      href: String,
      name: String,
    },
    tags: [String],
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

foodSchema.virtual("description").get(function (this: Food) {
  return `${this.name} has ${this.calories} calories`;
});

export const FoodModel: Model<Food> = model<Food>("Food", foodSchema);

interface RequiredField {
  name: string;
  about?: string;
}

const requiredSchema = new Schema<RequiredField>({
  about: String,
  name: {required: true, type: String},
});
export const RequiredModel = model<RequiredField>("Required", requiredSchema);

export function getBaseServer(): Express {
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
  return app;
}

export async function authAsUser(
  app: express.Application,
  type: "admin" | "notAdmin"
): Promise<TestAgent> {
  const email = type === "admin" ? "admin@example.com" : "notAdmin@example.com";
  const password = type === "admin" ? "securePassword" : "password";

  const agent = supertest.agent(app);
  const res = await agent.post("/auth/login").send({email, password}).expect(200);
  await agent.set("authorization", `Bearer ${res.body.data.token}`);
  return agent;
}

export async function setupDb() {
  await mongoose.connect("mongodb://127.0.0.1/ferns?&connectTimeoutMS=360000").catch(logger.catch);

  process.env.REFRESH_TOKEN_SECRET = "refresh_secret";
  process.env.TOKEN_SECRET = "secret";
  process.env.TOKEN_EXPIRES_IN = "30m";
  process.env.TOKEN_ISSUER = "example.com";
  process.env.SESSION_SECRET = "session";

  // Broken out of the try/catch below so you can test the catch logger by shutting down mongo.
  await Promise.all([UserModel.deleteMany({}), FoodModel.deleteMany({})]).catch(logger.catch);

  try {
    const [notAdmin, admin, adminOther] = await Promise.all([
      UserModel.create({email: "notAdmin@example.com", name: "Not Admin"}),
      UserModel.create({admin: true, email: "admin@example.com", name: "Admin"}),
      UserModel.create({admin: true, email: "admin+other@example.com", name: "Admin Other"}),
    ]);
    await (notAdmin as any).setPassword("password");
    await notAdmin.save();

    await (admin as any).setPassword("securePassword");
    await admin.save();

    await (adminOther as any).setPassword("otherPassword");

    await adminOther.save();

    return [admin, notAdmin, adminOther];
  } catch (error) {
    console.error("Error setting up DB", error);
    throw error;
  }
}
