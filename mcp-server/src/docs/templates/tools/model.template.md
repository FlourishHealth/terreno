import mongoose from "mongoose";
import {addDefaultPlugins{{softDeleteImport}}} from "@terreno/api";

interface {{Name}}Document extends mongoose.Document {
{{interfaceFields}}
}

interface {{Name}}Model extends mongoose.Model<{{Name}}Document> {
  findOneOrNone(query: mongoose.FilterQuery<{{Name}}Document>): Promise<{{Name}}Document | null>;
  findExactlyOne(query: mongoose.FilterQuery<{{Name}}Document>): Promise<{{Name}}Document>;
}

const {{lowerName}}Schema = new mongoose.Schema<{{Name}}Document, {{Name}}Model>(
  {
{{schemaFields}}
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

addDefaultPlugins({{lowerName}}Schema);
{{softDeletePlugin}}

export const {{Name}} = mongoose.model<{{Name}}Document, {{Name}}Model>("{{Name}}", {{lowerName}}Schema);
export type {{{Name}}Document, {{Name}}Model};
