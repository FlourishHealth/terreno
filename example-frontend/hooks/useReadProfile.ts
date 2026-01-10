import {useGetMeQuery} from "@/store";

export interface ProfileData {
  _id: string;
  id: string;
  email?: string;
  name?: string;
  admin?: boolean;
}

export function useReadProfile(): ProfileData | undefined {
  const {data: profileResponse} = useGetMeQuery();

  if (!profileResponse?.data) {
    return undefined;
  }

  return profileResponse.data as ProfileData;
}
