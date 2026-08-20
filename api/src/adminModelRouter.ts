import {DateTime} from "luxon";
import type {Document, Model} from "mongoose";

import type {AdminChangeEvent, AdminConfig} from "./adminTypes";
import type {ModelRouterOptions} from "./api";
import {scrubAdminFields, stripAdminBodyFields} from "./scrubAdminFields";
import type {TerrenoApp} from "./terrenoApp";

export interface ModelRouterBuildContext {
  openApi?: ModelRouterOptions<unknown>["openApi"];
  routePath?: string;
  terrenoApp?: TerrenoApp;
}

const emitAdminModelChanged = <T>({
  admin,
  doc,
  model,
  req,
  routePath,
  terrenoApp,
  type,
}: {
  admin: AdminConfig;
  doc: Document<unknown, unknown, unknown> & T;
  model: Model<T>;
  req: import("express").Request;
  routePath: string;
  terrenoApp: TerrenoApp;
  type: AdminChangeEvent["type"];
}): void => {
  const userId = req.user?._id ?? req.user?.id;
  if (!userId) {
    return;
  }

  const event: AdminChangeEvent = {
    at: DateTime.utc().toISO(),
    documentId: String(doc._id),
    modelName: model.modelName,
    routePath,
    type,
    user: {id: String(userId)},
  };

  if (type !== "delete") {
    event.document = scrubAdminFields(doc, {
      admin,
      schema: model.schema,
    });
  }

  terrenoApp.emitAdminModelChanged(event);
};

/**
 * Wraps modelRouter lifecycle hooks to enforce admin body scrubbing and optional realtime emits.
 */
export const enrichModelRouterOptions = <T>(
  model: Model<T>,
  options: ModelRouterOptions<T>,
  context: ModelRouterBuildContext
): ModelRouterOptions<T> => {
  const openApi = context.openApi ?? options.openApi;
  const admin = options.admin;
  const routePath = context.routePath;
  const terrenoApp = context.terrenoApp;

  if (!admin) {
    return openApi ? {...options, openApi} : options;
  }

  const userPreCreate = options.preCreate;
  const userPreUpdate = options.preUpdate;
  const userPostCreate = options.postCreate;
  const userPostUpdate = options.postUpdate;
  const userPostDelete = options.postDelete;

  return {
    ...options,
    openApi,
    postCreate: async (value, request) => {
      if (userPostCreate) {
        await userPostCreate(value, request);
      }
      if (admin.realtime && terrenoApp && routePath) {
        emitAdminModelChanged({
          admin,
          doc: value as Document<unknown, unknown, unknown> & T,
          model,
          req: request,
          routePath,
          terrenoApp,
          type: "create",
        });
      }
    },
    postDelete: async (request, value) => {
      if (userPostDelete) {
        await userPostDelete(request, value);
      }
      if (admin.realtime && terrenoApp && routePath) {
        emitAdminModelChanged({
          admin,
          doc: value as Document<unknown, unknown, unknown> & T,
          model,
          req: request,
          routePath,
          terrenoApp,
          type: "delete",
        });
      }
    },
    postUpdate: async (value, cleanedBody, request, prevValue) => {
      if (userPostUpdate) {
        await userPostUpdate(value, cleanedBody, request, prevValue);
      }
      if (admin.realtime && terrenoApp && routePath) {
        emitAdminModelChanged({
          admin,
          doc: value as Document<unknown, unknown, unknown> & T,
          model,
          req: request,
          routePath,
          terrenoApp,
          type: "update",
        });
      }
    },
    preCreate: async (value, request) => {
      let body = stripAdminBodyFields(
        value as Record<string, unknown> | Record<string, unknown>[] | null | undefined,
        admin
      ) as typeof value;
      if (userPreCreate) {
        body = await userPreCreate(body, request);
      }
      return body;
    },
    preUpdate: async (value, request) => {
      let body = stripAdminBodyFields(value, admin) as Partial<T>;
      if (userPreUpdate) {
        const next = await userPreUpdate(body, request);
        if (next === null) {
          return null;
        }
        body = next;
      }
      return body;
    },
  } as ModelRouterOptions<T>;
};
