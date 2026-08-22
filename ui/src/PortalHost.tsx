import type {FC, ReactNode} from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {type StyleProp, StyleSheet, View, type ViewStyle} from "react-native";

interface PortalManager {
  mount: (key: string, children: ReactNode) => void;
  update: (key: string, children: ReactNode) => void;
  unmount: (key: string) => void;
}

interface PortalEntry {
  children: ReactNode;
  key: string;
}

export const PortalContext = createContext<PortalManager | null>(null);

/**
 * Renders its children plus any content sent from a {@link Portal} on top of
 * them. Mount once near the root of the app (TerrenoProvider does this).
 */
export const Host: FC<{children?: ReactNode; style?: StyleProp<ViewStyle>}> = ({
  children,
  style,
}) => {
  const [portals, setPortals] = useState<PortalEntry[]>([]);

  const mount = useCallback((key: string, portalChildren: ReactNode): void => {
    setPortals((prev) => [
      ...prev.filter((entry) => entry.key !== key),
      {children: portalChildren, key},
    ]);
  }, []);

  const update = useCallback((key: string, portalChildren: ReactNode): void => {
    setPortals((prev) =>
      prev.map((entry) => (entry.key === key ? {...entry, children: portalChildren} : entry))
    );
  }, []);

  const unmount = useCallback((key: string): void => {
    setPortals((prev) => prev.filter((entry) => entry.key !== key));
  }, []);

  const manager = useMemo<PortalManager>(
    () => ({mount, unmount, update}),
    [mount, unmount, update]
  );

  return (
    <PortalContext.Provider value={manager}>
      <View collapsable={false} style={[{flex: 1, pointerEvents: "box-none"}, style]}>
        {children}
      </View>
      {portals.map(({children: portalChildren, key}) => (
        <View
          collapsable={false}
          key={key}
          style={[StyleSheet.absoluteFill, {pointerEvents: "box-none"}]}
        >
          {portalChildren}
        </View>
      ))}
    </PortalContext.Provider>
  );
};

/**
 * Teleports its children to the nearest {@link Host}, so overlays escape the
 * clipping and stacking context of the component that renders them.
 */
export const Portal: FC<{children?: ReactNode}> = ({children}) => {
  const manager = useContext(PortalContext);
  const key = useId();
  const childrenRef = useRef(children);
  childrenRef.current = children;

  // Register with the host on mount and clean up the portal when unmounting.
  useEffect(() => {
    if (!manager) {
      return;
    }
    manager.mount(key, childrenRef.current);
    return () => manager.unmount(key);
  }, [key, manager]);

  // Push the latest children into the host whenever the portal content changes.
  useEffect(() => {
    if (!manager) {
      return;
    }
    manager.update(key, children);
  }, [children, key, manager]);

  return null;
};
