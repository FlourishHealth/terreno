import React, {type ComponentType, lazy, Suspense} from "react";

import {Spinner} from "../Spinner";

type LazyComponentProps = Record<string, unknown>;
type LazyComponent = ComponentType<LazyComponentProps>;
type LazyComponentModule = {default: LazyComponent};

const isLazyComponent = (value: unknown): value is LazyComponent => {
  return typeof value === "function";
};

const resolveLazyComponentModule = async (
  factory: () => Promise<unknown>
): Promise<LazyComponentModule> => {
  const moduleNamespace = await factory();

  if (
    moduleNamespace &&
    typeof moduleNamespace === "object" &&
    "default" in moduleNamespace &&
    isLazyComponent(moduleNamespace.default)
  ) {
    return {default: moduleNamespace.default};
  }

  throw new Error("Lazy component factory must resolve to { default: Component }");
};

export const createLazyComponentExport = (
  factory: () => Promise<unknown>,
  staticProperties?: Record<string, unknown>
): LazyComponent => {
  const LazyComponent = lazy(() => resolveLazyComponentModule(factory));

  const LazyExport: React.FC<LazyComponentProps> = (props) => (
    <Suspense fallback={<Spinner />}>
      <LazyComponent {...props} />
    </Suspense>
  );

  if (staticProperties) {
    Object.assign(LazyExport, staticProperties);
  }

  return LazyExport;
};

export const createLazyNamedExport = (
  factory: () => Promise<unknown>,
  exportName: string
): LazyComponent => {
  return createLazyComponentExport(async () => {
    const moduleNamespace = (await factory()) as Record<string, unknown>;
    const component = moduleNamespace[exportName];

    if (!isLazyComponent(component)) {
      throw new Error(`Lazy export "${exportName}" was not found`);
    }

    return {default: component};
  });
};
