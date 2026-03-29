import {createdUpdatedPlugin, findExactlyOne, findOneOrNone, isDeletedPlugin} from "@terreno/api";
import {randomUUID} from "crypto";
import mongoose from "mongoose";

import type {ChartConfig} from "./chartTypes";

// ─── Document / Model interfaces ────────────────────────────────────────────

export type DashboardWidgetDocument = {
  widgetId: string;
  chart: ChartConfig;
};

import type {FindExactlyOnePlugin, FindOneOrNonePlugin} from "@terreno/api";

export type DashboardStatics = FindExactlyOnePlugin<DashboardDocument> &
  FindOneOrNonePlugin<DashboardDocument>;

export type DashboardDocument = mongoose.Document<mongoose.Types.ObjectId> & {
  created: Date;
  deleted: boolean;
  description?: string;
  title: string;
  updated: Date;
  userId: mongoose.Types.ObjectId;
  widgets: DashboardWidgetDocument[];
};

export type DashboardModel = mongoose.Model<DashboardDocument> & DashboardStatics;

// ─── Schema ──────────────────────────────────────────────────────────────────

const dashboardWidgetSchema = new mongoose.Schema<DashboardWidgetDocument>(
  {
    chart: {
      description: "Full ChartConfig for this widget",
      required: true,
      type: mongoose.Schema.Types.Mixed,
    },
    widgetId: {
      description: "Unique widget identifier (uuid v4), server-generated",
      required: true,
      type: String,
    },
  },
  {_id: false}
);

const dashboardSchema = new mongoose.Schema<DashboardDocument, DashboardModel>(
  {
    description: {
      description: "Optional description of the dashboard",
      type: String,
    },
    title: {
      description: "Dashboard title",
      required: true,
      trim: true,
      type: String,
    },
    userId: {
      description: "Admin user who created or last modified this dashboard",
      index: true,
      ref: "User",
      required: true,
      type: mongoose.Schema.Types.ObjectId,
    },
    widgets: {
      default: [],
      description: "Ordered list of chart widgets on this dashboard",
      type: [dashboardWidgetSchema],
    },
  },
  {strict: "throw", toJSON: {virtuals: true}, toObject: {virtuals: true}}
);

dashboardSchema.plugin(createdUpdatedPlugin);
dashboardSchema.plugin(isDeletedPlugin);
dashboardSchema.plugin(findOneOrNone);
dashboardSchema.plugin(findExactlyOne);

dashboardSchema.index({created: -1});
dashboardSchema.index({created: -1, userId: 1});

// Ensure widgetIds are always server-generated uuids
dashboardSchema.pre("save", function () {
  for (const widget of this.widgets) {
    if (!widget.widgetId) {
      widget.widgetId = randomUUID();
    }
  }
});

export const Dashboard = mongoose.model<DashboardDocument, DashboardModel>(
  "Dashboard",
  dashboardSchema
);

export const generateWidgetId = (): string => randomUUID();
