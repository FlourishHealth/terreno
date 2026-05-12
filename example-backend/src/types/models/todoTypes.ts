import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";
import type mongoose from "mongoose";
import type {BaseDocument} from "../../modelInterfaces";

// Todo Model Types
// biome-ignore lint/complexity/noBannedTypes: No methods.
export type TodoMethods = {};

export interface TodoStatics
  extends FindExactlyOnePlugin<TodoDocument>,
    FindOneOrNonePlugin<TodoDocument> {}

export interface TodoModel extends mongoose.Model<TodoDocument, object, TodoMethods>, TodoStatics {}

export interface TodoDocument extends BaseDocument, TodoMethods {
  title: string;
  completed: boolean;
  ownerId: mongoose.Types.ObjectId;
  tags: string[];
  priority?: "low" | "medium" | "high";
}
