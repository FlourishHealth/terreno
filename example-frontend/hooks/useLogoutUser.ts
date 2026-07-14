import {useCallback} from "react";
import {terrenoApi} from "@/store/sdk";
import {logout} from "@/store/index";
import {useAppDispatch} from "@/store/index";

type LogoutUser = () => void;

export const useLogoutUser = (): LogoutUser => {
  const dispatch = useAppDispatch();

  const handleLogout = useCallback((): void => {
    dispatch(logout());
    dispatch(terrenoApi.util.resetApiState());
  }, [dispatch]);

  return handleLogout;
};
