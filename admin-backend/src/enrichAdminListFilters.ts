import type {Model} from "mongoose";

import type {AdminListFilter} from "./adminUiV2";

/**
 * Derives `allowEmpty` for optional choice filters from the Mongoose schema when not
 * set explicitly on admin config.
 */
export const enrichAdminListFilters = (
  filters: AdminListFilter[] | undefined,
  model: Model<unknown>
): AdminListFilter[] | undefined => {
  if (!filters) {
    return filters;
  }
  return filters.map((filter) => {
    if (filter.kind !== "choice") {
      return filter;
    }
    if (filter.allowEmpty !== undefined) {
      return filter;
    }
    const path = model.schema.path(filter.field);
    if (!path || path.isRequired) {
      return filter;
    }
    return {...filter, allowEmpty: true};
  });
};
