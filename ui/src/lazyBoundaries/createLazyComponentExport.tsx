// biome-ignore-all lint/suspicious/noExplicitAny: lazy root export boundary accepts heterogeneous component props
import React, {type ComponentType, lazy, Suspense} from "react";

import {Spinner} from "../Spinner";

export const createLazyComponentExport = (
  factory: () => Promise<{default: ComponentType<any>}>,
  staticProperties?: Record<string, unknown>
): ComponentType<any> => {
  const LazyComponent = lazy(factory);

  const LazyExport: React.FC<any> = (props) => (
    <Suspense fallback={<Spinner />}>
      <LazyComponent {...props} />
    </Suspense>
  );

  if (staticProperties) {
    Object.assign(LazyExport, staticProperties);
    void factory().then((moduleNamespace) => {
      Object.assign(LazyExport, moduleNamespace.default);
    });
  }

  return LazyExport;
};

export const createLazyNamedExport = (
  factory: () => Promise<Record<string, ComponentType<any>>>,
  exportName: string
): ComponentType<any> => {
  return createLazyComponentExport(async () => {
    const moduleNamespace = await factory();
    const component = moduleNamespace[exportName];

    if (!component) {
      throw new Error(`Lazy export "${exportName}" was not found`);
    }

    return {default: component};
  });
};
