import {createContext, type FC, type ReactNode, useContext, useMemo} from "react";

import type {CustomIconComponent, IconName, IconRegistryMap} from "./Common";
import {BarsFilterIcon} from "./icons/BarsFilterIcon";

// Icons shipped with @terreno/ui and always available via `iconName`. Consumer
// icons passed to the provider override these on name collision.
const BUILT_IN_ICONS: IconRegistryMap = {
  "bars-filter": ({color, size, testID}) => (
    <BarsFilterIcon fill={color} height={size} testID={testID} width={size} />
  ),
};

const IconRegistryContext = createContext<IconRegistryMap>(BUILT_IN_ICONS);

interface IconRegistryProviderProps {
  /** Map of custom icon name to the component that renders it. */
  icons?: IconRegistryMap;
  children: ReactNode;
}

export const IconRegistryProvider: FC<IconRegistryProviderProps> = ({icons, children}) => {
  // Built-in icons are always available; consumer icons override them by name.
  const mergedIcons = useMemo(() => ({...BUILT_IN_ICONS, ...icons}), [icons]);
  return (
    <IconRegistryContext.Provider value={mergedIcons}>{children}</IconRegistryContext.Provider>
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
