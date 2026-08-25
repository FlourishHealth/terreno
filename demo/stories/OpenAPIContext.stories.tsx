import {Box, Heading, OpenAPIProvider, Text, useOpenAPISpec} from "@terreno/ui";
import React, {useCallback, useState} from "react";

const DEMO_SPEC = {
  paths: {
    "/todoItems/": {
      get: {
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  properties: {
                    data: {
                      items: {
                        properties: {
                          completed: {
                            description: "Whether the todo item has been completed",
                            type: "boolean",
                          },
                          title: {
                            description: "Title for the todo item",
                            type: "string",
                          },
                        },
                        required: ["title"],
                        type: "object",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const DEMO_SPEC_URL = "https://demo.example/openapi.json";
const originalFetch = globalThis.fetch;

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input.toString();
  if (url !== DEMO_SPEC_URL) {
    return originalFetch(input);
  }
  return {
    json: async () => DEMO_SPEC,
  };
}) as typeof globalThis.fetch;

const FieldMetadataPanel: React.FC = () => {
  const {getModelField, getModelFields} = useOpenAPISpec();
  const modelFields = getModelFields("Todo Items");
  const titleField = getModelField("Todo Items", "title");
  const completedField = getModelField("Todo Items", "completed");

  return (
    <Box gap={3}>
      <Text>{`Required fields: ${modelFields?.required?.join(", ") ?? "none"}`}</Text>
      <Text>{`Title: ${titleField?.description ?? "loading..."}`}</Text>
      <Text>{`Completed: ${completedField?.description ?? "loading..."}`}</Text>
    </Box>
  );
};

const OpenAPIContextDemoBody: React.FC = () => {
  const [parentRevision, setParentRevision] = useState(0);
  const bumpParent = useCallback((): void => {
    setParentRevision((value) => value + 1);
  }, []);

  return (
    <Box gap={4} padding={4}>
      <Heading size="md">OpenAPI field metadata</Heading>
      <Text>
        Parent revision {parentRevision}. Bump the parent to confirm field descriptions stay stable
        while the OpenAPI spec is unchanged.
      </Text>
      <Box
        accessibilityRole="button"
        border="default"
        onClick={bumpParent}
        padding={2}
        rounding="md"
        testID="openapi-bump-parent"
      >
        <Text>Bump parent render</Text>
      </Box>
      <FieldMetadataPanel />
    </Box>
  );
};

export const OpenAPIContextStories: React.FC = () => {
  return (
    <OpenAPIProvider specUrl={DEMO_SPEC_URL}>
      <OpenAPIContextDemoBody />
    </OpenAPIProvider>
  );
};

export const OpenAPIContextDemo: React.FC = () => {
  return <OpenAPIContextStories />;
};
