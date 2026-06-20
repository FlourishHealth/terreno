import {createContext, type FC, type ReactNode, useContext} from "react";

import type {CustomIconComponent, IconName, IconRegistryMap} from "./Common";

// Stable empty registry so consumers that don't register icons don't trigger
// unnecessary context re-renders.
const EMPTY_REGISTRY: IconRegistryMap = {};

const IconRegistryContext = createContext<IconRegistryMap>(EMPTY_REGISTRY);

interface IconRegistryProviderProps {
  /** Map of custom icon name to the component that renders it. */
  icons?: IconRegistryMap;
  children: ReactNode;
}

export const IconRegistryProvider: FC<IconRegistryProviderProps> = ({icons, children}) => {
  return (
    <IconRegistryContext.Provider value={icons ?? EMPTY_REGISTRY}>
      {children}
    </IconRegistryContext.Provider>
  );
};

/** Returns the full map of registered custom icons. */
export const useIconRegistry = (): IconRegistryMap => {
  return useContext(IconRegistryContext);
};

/**
 * Returns the registered custom icon component for the given name, or undefined
 * when the name is not a registered custom icon (in which case callers should
 * fall through to rendering a FontAwesome icon).
 */
export const useCustomIcon = (iconName?: IconName): CustomIconComponent | undefined => {
  const registry = useContext(IconRegistryContext);
  if (!iconName) {
    return undefined;
  }
  return registry[iconName];
};
