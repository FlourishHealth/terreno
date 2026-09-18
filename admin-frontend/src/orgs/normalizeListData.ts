/**
 * `@terreno/rtk`'s base query unwraps `{data}` for responses without pagination
 * metadata (`more`), so list hooks may receive a bare array. Custom base queries
 * may still pass the JSON API envelope.
 */
export type ListQueryData<T> = T[] | {data?: T[]} | undefined;

export const normalizeListData = <T>(data: ListQueryData<T>): T[] => {
  if (Array.isArray(data)) {
    return data;
  }
  return data?.data ?? [];
};
