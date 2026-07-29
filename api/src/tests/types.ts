import type {HydratedDocument} from "mongoose";

import type {Food, RequiredField, User} from "./models";

export interface TestUsers {
  admin: HydratedDocument<User>;
  adminOther: HydratedDocument<User>;
  notAdmin: HydratedDocument<User>;
}

export interface TestFoods {
  apple: HydratedDocument<Food>;
  carrots: HydratedDocument<Food>;
  pizza: HydratedDocument<Food>;
  spinach: HydratedDocument<Food>;
}

export interface TestRequired {
  sample: HydratedDocument<RequiredField>;
  withAbout: HydratedDocument<RequiredField>;
}

/** Canonical API integration-test fixture graph. */
export interface TestData {
  foods: TestFoods;
  required: TestRequired;
  users: TestUsers;
}

/** JSON-serializable snapshot stored alongside collection cache files. */
export interface CachedTestData {
  foods: Record<keyof TestFoods, string>;
  required: Record<keyof TestRequired, string>;
  users: Record<keyof TestUsers, string>;
}
