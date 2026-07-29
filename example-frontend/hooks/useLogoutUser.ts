import {useCallback} from "react";
import {logout, useAppDispatch} from "@/store/index";
import {terrenoApi} from "@/store/sdk";

type LogoutUser = () => void;

export const useLogoutUser = (): LogoutUser => {
  const dispatch = useAppDispatch();

  const handleLogout = useCallback((): void => {
    dispatch(logout());
    dispatch(terrenoApi.util.resetApiState());
  }, [dispatch]);

  return handleLogout;
};
