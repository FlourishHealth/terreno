// biome-ignore-all lint/suspicious/noExplicitAny: Generics

// use this with enhanceEndpoints since the code generator doesn't invalidate by individual ids,
// only at the full collection level

const providesIdTags =
  (path: string) =>
  (result: any): string[] | [{type: string; id?: string}] =>
    result ? [...(result?.data?.map(({_id}: any) => ({id: _id, type: path})) ?? []), path] : [path];

const providesIdTag =
  (path: string) =>
  (result: any): string[] | [{type: string; id?: string}] => {
    return result ? [{id: result._id, type: path}] : [path];
  };

const invalidatesIdTags =
  (path: string) =>
  (result: any): string[] | [{type: string; id?: string}] =>
    result ? [...(result?.data?.map(({_id}: any) => ({id: _id, type: path})) ?? []), path] : [path];

const cleanEndpointStringToGenerateTag = (string: string): string => {
  // Define the prefixes and suffix
  const prefixes = ["patch", "get", "delete"];
  const suffix = "ById";

  // Create a regular expression to match the prefixes and suffix
  const prefixPattern = `^(${prefixes.join("|")})`;
  const suffixPattern = `${suffix}$`;
  const regex = new RegExp(`${prefixPattern}|${suffixPattern}`, "gi");

  // Replace the matched parts and convert to lowercase
  return string.replace(regex, "")?.toLowerCase();
};

export const generateTags = (api: any, tagTypes: string[]): any => {
  // take the api, and for each get and list endpoint, generate tags that invalidate the cache by id
  // and by the list endpoint
  const endpoints = api.endpoints;
  const tags: any = {};
  Object.keys(endpoints).forEach((endpoint) => {
    if (endpoint === "getConversations") {
      tags[endpoint] = {invalidatesTags: ["conversations", "messages"]};
    }
    if (endpoint.toLowerCase().includes("get")) {
      // List endpoints
      if (!endpoint.toLowerCase().includes("byid")) {
        const tag = tagTypes.find((t: string) =>
          // remove "get" from the endpoint name and "ById" from the endpoint name
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
  return tags;
};
