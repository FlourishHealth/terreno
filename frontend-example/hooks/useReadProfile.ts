import {skipToken} from "@reduxjs/toolkit/query/react";
import type {RootState} from "@terreno/rtk";
import {useSelector} from "react-redux";

// NOTE: These types are expected to be generated from the OpenAPI spec
// Defining user shape based on actual usage in the codebase
type GetUsersByIdRes = {
  _id: string;
  email?: string;
  name?: string;
  type?: string;
  admin?: boolean;
  expoTokens?: string[];
  online?: {
    forPatients?: boolean;
    forFamilyMembers?: boolean;
  };
};

// NOTE: This query hook is expected to be generated from the OpenAPI spec
// Using defined type for the placeholder return type
const useGetUsersByIdQuery = (_id: string | typeof skipToken): {data?: GetUsersByIdRes} => {
  // Placeholder - should be replaced with actual generated hook from OpenAPI spec
  return {data: undefined};
};

export function useReadProfile(): GetUsersByIdRes | undefined {
  const currentUserId = useSelector((state: RootState): string | undefined => {
    return state.auth?.userId;
  });
  const {data: userData} = useGetUsersByIdQuery(currentUserId ?? skipToken);
  if (!currentUserId) {
    return undefined;
  }
  return userData as GetUsersByIdRes;
}
