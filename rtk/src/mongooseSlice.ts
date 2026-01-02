export interface ListResponse<T> {
  page?: number;
  limit?: number;
  more?: boolean;
  total?: number;
  data?: T[];
}

// Given an ID and the {data} from a list query, return the object with that ID.
// Does not fill in the object like populating in Mongoose.
export function populateId<T extends {_id: string}>(
  id?: string,
  objs?: ListResponse<T>
): T | undefined {
  if (!id || !objs) {
    return undefined;
  }
  return objs?.data?.find((obj) => obj?._id === id);
}
