import {Permissions, type ModelRouterOptions, modelRouter{{additionalImports}}} from "@terreno/api";
import type {Router} from "express";
import {{{Name}}} from "../models";
import type {{{Name}}Document} from "../types";

export const add{{Name}}Routes = (
  router: Router,
  options?: Partial<ModelRouterOptions<{{Name}}Document>>
): void => {
  router.use(
    "/{{routePath}}",
    modelRouter({{Name}}, {
      ...options,
      permissions: {
        create: [{{createPermissions}}],
        delete: [{{deletePermissions}}],
        list: [{{listPermissions}}],
        read: [{{readPermissions}}],
        update: [{{updatePermissions}}],
      },
      {{queryFilter}}
      queryFields: [{{queryFields}}],
      sort: "{{sort}}",
    })
  );
};
