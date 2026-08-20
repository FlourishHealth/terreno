import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";
import type mongoose from "mongoose";

// Todo Model Types
// biome-ignore lint/complexity/noBannedTypes: No methods.
export type TodoMethods = {};

export interface TodoStatics
  extends FindExactlyOnePlugin<TodoDocument>,
    FindOneOrNonePlugin<TodoDocument> {}

export interface TodoModel extends mongoose.Model<TodoDocument, object, TodoMethods>, TodoStatics {}

// Todos are synced via @terreno/syncdb, so _id is a String (offline clients mint
// their own ids) rather than the BaseDocument ObjectId.
export interface TodoDocument extends mongoose.Document<string>, TodoMethods {
  _id: string;
  title: string;
  completed: boolean;
  ownerId: mongoose.Types.ObjectId;
  tags: string[];
  priority?: "low" | "medium" | "high";
  created: Date;
  updated: Date;
  deleted: boolean;
}
