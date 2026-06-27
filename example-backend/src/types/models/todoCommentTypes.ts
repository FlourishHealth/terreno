import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";
import type mongoose from "mongoose";
import type {BaseDocument} from "../../modelInterfaces";

// TodoComment Model Types
// biome-ignore lint/complexity/noBannedTypes: No methods.
export type TodoCommentMethods = {};

export interface TodoCommentStatics
  extends FindExactlyOnePlugin<TodoCommentDocument>,
    FindOneOrNonePlugin<TodoCommentDocument> {}

export interface TodoCommentModel
  extends mongoose.Model<TodoCommentDocument, object, TodoCommentMethods>,
    TodoCommentStatics {}

export interface TodoCommentDocument extends BaseDocument, TodoCommentMethods {
  todoId: mongoose.Types.ObjectId;
  text: string;
  ownerId: mongoose.Types.ObjectId;
}
