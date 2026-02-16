import {useCallback} from "react";
import {logout, terrenoApi, useAppDispatch} from "@/store";

type LogoutUser = () => void;

export function useLogoutUser(): LogoutUser {
  const dispatch = useAppDispatch();

  const handleLogout = useCallback((): void => {
    dispatch(logout());
    dispatch(terrenoApi.util.resetApiState());
  }, [dispatch]);

  return handleLogout;
}
