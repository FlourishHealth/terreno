import {selectBetterAuthUserId} from "@terreno/rtk";
import {useSelector} from "react-redux";
import {useGetMeQuery} from "@/store";

export interface ProfileData {
  _id: string;
  id: string;
  email?: string;
  name?: string;
  admin?: boolean;
}

export const useReadProfile = (): ProfileData | undefined => {
  const userId = useSelector(selectBetterAuthUserId);
  const {data: profile} = useGetMeQuery(undefined, {skip: !userId});

  if (!profile) {
    return undefined;
  }

  return profile as ProfileData;
};
