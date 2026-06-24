import type {HydratedDocument} from "mongoose";
import type {PassportLocalMongooseDocument} from "passport-local-mongoose";

import {logger} from "../logger";
import {FoodModel, RequiredModel, type User, UserModel} from "./models";
import type {CachedTestData, TestData, TestFoods, TestRequired, TestUsers} from "./types";

const setPassword = async (user: HydratedDocument<User>, password: string): Promise<void> => {
  await (user as unknown as PassportLocalMongooseDocument).setPassword(password);
  await user.save();
};

export const clearTestCollections = async (): Promise<void> => {
  await Promise.all([
    UserModel.deleteMany({}),
    FoodModel.deleteMany({}),
    RequiredModel.deleteMany({}),
  ]).catch(logger.catch);
};

export const createTestUsers = async (): Promise<TestUsers> => {
  const [notAdmin, admin, adminOther] = await Promise.all([
    UserModel.create({email: "notAdmin@example.com", name: "Not Admin"}),
    UserModel.create({admin: true, email: "admin@example.com", name: "Admin"}),
    UserModel.create({admin: true, email: "admin+other@example.com", name: "Admin Other"}),
  ]);

  await Promise.all([
    setPassword(notAdmin, "password"),
    setPassword(admin, "securePassword"),
    setPassword(adminOther, "otherPassword"),
  ]);

  return {admin, adminOther, notAdmin};
};

export const createStandardFoods = async (users: TestUsers): Promise<TestFoods> => {
  const {admin, adminOther, notAdmin} = users;

  const [spinach, apple, carrots, pizza] = await Promise.all([
    FoodModel.create({
      calories: 1,
      categories: [{name: "Vegetables", show: true}],
      created: new Date("2021-12-03T00:00:20.000Z"),
      eatenBy: [admin._id],
      expiration: "2026-12-31",
      hidden: false,
      lastEatenWith: {
        dressing: new Date("2021-12-03T19:00:30.000Z"),
      },
      likesIds: [
        {likes: true, userId: admin._id},
        {likes: false, userId: notAdmin._id},
      ],
      name: "Spinach",
      ownerId: notAdmin._id,
      source: {
        dateAdded: "2023-12-13T12:30:00.000Z",
        href: "https://www.example.com/spinach",
        name: "Brand",
      },
      tags: ["healthy"],
    }),
    FoodModel.create({
      calories: 100,
      created: new Date("2021-12-03T00:00:30.000Z"),
      expiration: "2026-12-31",
      hidden: true,
      likesIds: [{likes: true, userId: admin._id}],
      name: "Apple",
      ownerId: admin._id,
      source: {name: "Orchard"},
      tags: ["healthy"],
    }),
    FoodModel.create({
      calories: 100,
      created: new Date("2021-12-03T00:00:00.000Z"),
      eatenBy: [admin._id, notAdmin._id],
      expiration: "2026-12-31",
      hidden: false,
      likesIds: [{likes: false, userId: notAdmin._id}],
      name: "Carrots",
      ownerId: admin._id,
      source: {name: "Farm"},
      tags: ["vegetable"],
    }),
    FoodModel.create({
      calories: 800,
      created: new Date("2022-01-01T00:00:00.000Z"),
      expiration: "2026-12-31",
      hidden: false,
      likesIds: [{likes: true, userId: adminOther._id}],
      name: "Pizza",
      ownerId: adminOther._id,
      source: {name: "Pizzeria"},
      tags: ["comfort"],
    }),
  ]);

  return {apple, carrots, pizza, spinach};
};

export const createRequiredFixtures = async (): Promise<TestRequired> => {
  const [sample, withAbout] = await Promise.all([
    RequiredModel.create({name: "Sample Required"}),
    RequiredModel.create({about: "Optional about text", name: "Required With About"}),
  ]);

  return {sample, withAbout};
};

/** Builds the standard Terreno API test database (users, foods, required docs). */
export const createTestData = async (): Promise<TestData> => {
  await clearTestCollections();

  const users = await createTestUsers();
  const [foods, required] = await Promise.all([
    createStandardFoods(users),
    createRequiredFixtures(),
  ]);

  return {foods, required, users};
};

export const toCachedTestData = (testData: TestData): CachedTestData => ({
  foods: {
    apple: testData.foods.apple.id,
    carrots: testData.foods.carrots.id,
    pizza: testData.foods.pizza.id,
    spinach: testData.foods.spinach.id,
  },
  required: {
    sample: testData.required.sample.id,
    withAbout: testData.required.withAbout.id,
  },
  users: {
    admin: testData.users.admin.id,
    adminOther: testData.users.adminOther.id,
    notAdmin: testData.users.notAdmin.id,
  },
});

export const loadTestDataFromDocuments = async (cached: CachedTestData): Promise<TestData> => {
  const [admin, notAdmin, adminOther, spinach, apple, carrots, pizza, sample, withAbout] =
    await Promise.all([
      UserModel.findById(cached.users.admin),
      UserModel.findById(cached.users.notAdmin),
      UserModel.findById(cached.users.adminOther),
      FoodModel.findById(cached.foods.spinach),
      FoodModel.findById(cached.foods.apple),
      FoodModel.findById(cached.foods.carrots),
      FoodModel.findById(cached.foods.pizza),
      RequiredModel.findById(cached.required.sample),
      RequiredModel.findById(cached.required.withAbout),
    ]);

  if (
    !admin ||
    !notAdmin ||
    !adminOther ||
    !spinach ||
    !apple ||
    !carrots ||
    !pizza ||
    !sample ||
    !withAbout
  ) {
    throw new Error("[createTestData] Cached test data references missing documents");
  }

  return {
    foods: {apple, carrots, pizza, spinach},
    required: {sample, withAbout},
    users: {admin, adminOther, notAdmin},
  };
};
