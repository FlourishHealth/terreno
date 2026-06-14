interface IsForbiddenAdminConfigErrorOptions {
  error: unknown;
  isAuthenticated: boolean;
  isConfigLoading: boolean;
  status?: number;
}

export const isForbiddenAdminConfigError = ({
  error,
  isAuthenticated,
  isConfigLoading,
  status,
}: IsForbiddenAdminConfigErrorOptions): boolean => {
  if (!isAuthenticated) {
    return false;
  }
  if (isConfigLoading) {
    return false;
  }
  if (!error) {
    return false;
  }
  return status === 403;
};
