import {createContext, useContext, useMemo, type ReactElement, type ReactNode} from "react";

interface EmbedModeContextValue {
  isEmbedMode: boolean;
}

const EmbedModeContext = createContext<EmbedModeContextValue>({isEmbedMode: false});

export const useEmbedMode = (): EmbedModeContextValue => useContext(EmbedModeContext);

interface EmbedModeProviderProps {
  children: ReactNode;
  isEmbedMode: boolean;
}

export const EmbedModeProvider = ({children, isEmbedMode}: EmbedModeProviderProps): ReactElement => {
  const value = useMemo(() => ({isEmbedMode}), [isEmbedMode]);
  return <EmbedModeContext.Provider value={value}>{children}</EmbedModeContext.Provider>;
};
