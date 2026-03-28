import {useGetMeQuery} from "@/store";

export interface ProfileData {
  _id: string;
  id: string;
  email?: string;
  name?: string;
  admin?: boolean;
}

export const useReadProfile = (): ProfileData | undefined => {
  const {data: profile} = useGetMeQuery();

  if (!profile) {
    return undefined;
  }

  return profile as ProfileData;
};
