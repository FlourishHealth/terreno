/** Normalize admin model route paths for collision detection (`/users` and `/users/` match). */
export const normalizeAdminRoutePath = (routePath: string): string => {
  if (!routePath) {
    return "/";
  }
  let path = routePath.trim();
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  if (path.length > 1 && path.endsWith("/")) {
    path = path.replace(/\/+$/, "");
  }
  return path;
};
