// Tag generation utilities for RTK Query endpoint cache invalidation by individual IDs

interface TagProviderResult {
  data?: Array<{_id: string}>;
  _id?: string;
}

type TagEntry = string | {type: string; id?: string};
type TagProviderFn = (result: TagProviderResult | null | undefined) => TagEntry[];

interface EndpointTagConfig {
  providesTags: TagProviderFn;
  invalidatesTags: TagProviderFn;
}

interface ApiWithEndpoints {
  endpoints: Record<string, unknown>;
}

const providesIdTags =
  (path: string) =>
  (result: TagProviderResult | null | undefined): TagEntry[] =>
    result ? [...(result?.data?.map(({_id}) => ({id: _id, type: path})) ?? []), path] : [path];

const providesIdTag =
  (path: string) =>
  (result: TagProviderResult | null | undefined): TagEntry[] => {
    return result ? [{id: result._id, type: path}] : [path];
  };

const invalidatesIdTags =
  (path: string) =>
  (result: TagProviderResult | null | undefined): TagEntry[] =>
    result ? [...(result?.data?.map(({_id}) => ({id: _id, type: path})) ?? []), path] : [path];

/** Strips CRUD prefixes and "ById" suffix to extract the base resource name. */
const cleanEndpointStringToGenerateTag = (string: string): string => {
  const prefixes = ["patch", "get", "delete"];
  const suffix = "ById";

  const prefixPattern = `^(${prefixes.join("|")})`;
  const suffixPattern = `${suffix}$`;
  const regex = new RegExp(`${prefixPattern}|${suffixPattern}`, "gi");

  return string.replace(regex, "")?.toLowerCase();
};

export const generateTags = (
  api: ApiWithEndpoints,
  tagTypes: string[]
): Record<string, EndpointTagConfig> => {
  const endpoints = api.endpoints;
  const tags: Record<string, Partial<EndpointTagConfig>> = {};
  Object.keys(endpoints).forEach((endpoint) => {
    if (endpoint === "getConversations") {
      tags[endpoint] = {invalidatesTags: (): TagEntry[] => ["conversations", "messages"]};
    }
    if (endpoint.toLowerCase().includes("get")) {
      // List endpoints
      if (!endpoint.toLowerCase().includes("byid")) {
        const tag = tagTypes.find((t: string) =>
          t.toLowerCase().includes(cleanEndpointStringToGenerateTag(endpoint))
        );
        if (tag) {
          tags[endpoint] = {providesTags: providesIdTags(tag)};
        }
      }
      // Read endpoints
      else {
        const tag = tagTypes.find((t: string) =>
          t.toLowerCase().includes(cleanEndpointStringToGenerateTag(endpoint))
        );
        if (tag) {
          tags[endpoint] = {providesTags: providesIdTag(tag)};
        }
      }
    }
    // Patch and delete endpoints
    else if (
      endpoint.toLowerCase().includes("patch") ||
      endpoint.toLowerCase().includes("delete")
    ) {
      const tag = tagTypes.find((t: string) =>
        t.toLowerCase().includes(cleanEndpointStringToGenerateTag(endpoint))
      );
      if (tag) {
        tags[endpoint] = {invalidatesTags: invalidatesIdTags(tag)};
      }
    }
  });
  return tags as Record<string, EndpointTagConfig>;
};
