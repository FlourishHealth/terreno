import {syncPlugin} from "@terreno/api";
import mongoose from "mongoose";
import type {ProjectDocument, ProjectModel} from "../types";
import {addDefaultPlugins} from "./modelPlugins";

/**
 * Tenant-scoped sync example: projects belong to an organization, and every member
 * of that organization shares the same sync stream (`projects|tenant:{organizationId}`).
 */
const projectSchema = new mongoose.Schema<ProjectDocument, ProjectModel>(
  {
    _id: {
      // Synced models need a String _id: offline syncdb clients mint entity ids
      // (UUIDs) locally and the sync mutation channel writes them through as _id.
      default: (): string => new mongoose.Types.ObjectId().toHexString(),
      description: "The document id (String so offline sync clients can mint ids)",
      type: String,
    },
    organizationId: {
      description: "The organization (tenant) this project belongs to",
      required: true,
      type: String,
    },
    title: {
      description: "The title of the project",
      required: true,
      trim: true,
      type: String,
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

addDefaultPlugins(projectSchema);
// Stamps a per-stream _syncSeq on every write; required by the projects router's sync config.
projectSchema.plugin(syncPlugin);

// Named "ExampleProject" because @terreno/ai (imported by server.ts) already registers a
// mongoose model called "Project" for Langfuse. The exported binding and the /projects
// route keep the friendly name.
export const Project = mongoose.model<ProjectDocument, ProjectModel>(
  "ExampleProject",
  projectSchema
);
