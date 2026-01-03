import {usePatchMeMutation} from "@/store";

export interface UpdateProfileArgs {
  name?: string;
  email?: string;
  password?: string;
}

export interface UpdateProfileResult {
  updateProfile: (updates: UpdateProfileArgs) => Promise<void>;
  isLoading: boolean;
  error: unknown;
}

export function useUpdateProfile(): UpdateProfileResult {
  const [patchMe, {isLoading, error}] = usePatchMeMutation();

  const updateProfile = async (updates: UpdateProfileArgs): Promise<void> => {
    await patchMe(updates).unwrap();
  };

  return {
    error,
    isLoading,
    updateProfile,
  };
}
