import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";
import type mongoose from "mongoose";

// Project Model Types
// biome-ignore lint/complexity/noBannedTypes: No methods.
export type ProjectMethods = {};

export interface ProjectStatics
  extends FindExactlyOnePlugin<ProjectDocument>,
    FindOneOrNonePlugin<ProjectDocument> {}

export interface ProjectModel
  extends mongoose.Model<ProjectDocument, object, ProjectMethods>,
    ProjectStatics {}

// Projects are synced via @terreno/syncdb with a tenant scope, so _id is a String
// (offline clients mint their own ids) rather than the BaseDocument ObjectId.
export interface ProjectDocument extends mongoose.Document<string>, ProjectMethods {
  _id: string;
  title: string;
  organizationId: string;
  created: Date;
  updated: Date;
  deleted: boolean;
}
