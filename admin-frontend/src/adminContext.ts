import {createContext, useContext} from "react";
import type {AdminProviderValue} from "./types";

export const AdminWidgetContext = createContext<AdminProviderValue | null>(null);

export const useAdminContext = (): AdminProviderValue | null => {
  return useContext(AdminWidgetContext);
};
