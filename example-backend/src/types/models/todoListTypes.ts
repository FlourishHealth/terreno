import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";
import type mongoose from "mongoose";
import type {BaseDocument} from "../../modelInterfaces";

// TodoList Model Types
// biome-ignore lint/complexity/noBannedTypes: No methods.
export type TodoListMethods = {};

export interface TodoListStatics
  extends FindExactlyOnePlugin<TodoListDocument>,
    FindOneOrNonePlugin<TodoListDocument> {}

export interface TodoListModel
  extends mongoose.Model<TodoListDocument, object, TodoListMethods>,
    TodoListStatics {}

export interface TodoListDocument extends BaseDocument, TodoListMethods {
  name: string;
  color?: string;
  ownerId: mongoose.Types.ObjectId;
}
