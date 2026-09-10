import {mock} from "bun:test";

type HookFactory = (...args: unknown[]) => unknown;

const hookOverrides = new Map<string, HookFactory>();

const defaultMutation = (): unknown[] => [
  mock(() => ({unwrap: async () => ({})})),
  {isLoading: false},
];

const defaultHooks: Record<string, HookFactory> = {
  useBulkPatchMutation: defaultMutation,
  useCreateMutation: defaultMutation,
  useDeleteMutation: defaultMutation,
  useListQuery: () => ({
    data: {data: [], total: 0},
    error: null,
    isError: false,
    isLoading: false,
    refetch: mock(() => {}),
  }),
  useReadQuery: (_id?: unknown, opts?: {skip?: boolean}) => {
    if (opts?.skip) {
      return {data: undefined, isLoading: false};
    }
    return {data: undefined, error: null, isLoading: false};
  },
  useUpdateMutation: defaultMutation,
};

export const configureUseAdminApiDouble = (overrides: Record<string, HookFactory>): void => {
  for (const [key, factory] of Object.entries(overrides)) {
    hookOverrides.set(key, factory);
  }
};

export const resetUseAdminApiDouble = (): void => {
  hookOverrides.clear();
};

const resolveHook = (prop: string): HookFactory => {
  const override = hookOverrides.get(prop);
  if (override) {
    return override;
  }
  const defaultHook = defaultHooks[prop];
  if (defaultHook) {
    return defaultHook;
  }
  if (prop.endsWith("Mutation")) {
    return defaultMutation;
  }
  if (prop.endsWith("Query")) {
    return () => ({data: undefined, error: null, isLoading: false});
  }
  return () => undefined;
};

mock.module("../useAdminApi", () => ({
  useAdminApi: () =>
    new Proxy(
      {},
      {
        get: (_target, prop: string) => resolveHook(prop),
      }
    ),
}));
