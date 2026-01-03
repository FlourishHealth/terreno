import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";
import type mongoose from "mongoose";
import type {BaseDocument} from "../../modelInterfaces";

// Todo Model Types
export type TodoMethods = {};

export type TodoStatics = FindExactlyOnePlugin<TodoDocument> & FindOneOrNonePlugin<TodoDocument>;

export type TodoModel = mongoose.Model<TodoDocument, object, TodoMethods> & TodoStatics;

export type TodoDocument = BaseDocument &
  TodoMethods & {
    title: string;
    completed: boolean;
    ownerId: mongoose.Types.ObjectId;
  };

