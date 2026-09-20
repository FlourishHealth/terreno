export interface NamedOrganization {
  _id: string;
  name: string;
}

/** Stable ordering for deterministic default org selection (name, then id). */
export const sortOrganizations = <T extends NamedOrganization>(organizations: T[]): T[] =>
  [...organizations].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    if (byName !== 0) {
      return byName;
    }
    return String(left._id).localeCompare(String(right._id));
  });
