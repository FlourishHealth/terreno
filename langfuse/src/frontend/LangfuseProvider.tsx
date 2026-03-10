import React, {createContext, useContext} from "react";

interface LangfuseContextValue {
  apiBaseUrl: string;
}

const LangfuseContext = createContext<LangfuseContextValue>({
  apiBaseUrl: "/admin/langfuse",
});

interface LangfuseProviderProps {
  apiBaseUrl?: string;
  children: React.ReactNode;
}

export const LangfuseProvider: React.FC<LangfuseProviderProps> = ({
  apiBaseUrl = "/admin/langfuse",
  children,
}) => {
  return <LangfuseContext.Provider value={{apiBaseUrl}}>{children}</LangfuseContext.Provider>;
};

export const useLangfuseContext = (): LangfuseContextValue => {
  return useContext(LangfuseContext);
};
