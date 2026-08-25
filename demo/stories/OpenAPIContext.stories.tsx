import {Box, Heading, OpenAPIProvider, Text, useOpenAPISpec} from "@terreno/ui";
import React, {useCallback, useEffect, useState} from "react";

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
        accessibilityHint="Increments the parent revision counter"
        accessibilityLabel="Bump parent render"
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

const OpenAPIContextStoriesBody: React.FC = () => {
  const [hasMockedFetch, setHasMockedFetch] = useState(false);

  // Install the demo fetch mock before OpenAPIProvider loads the spec URL.
  useEffect(() => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url !== DEMO_SPEC_URL) {
        return originalFetch(input, init);
      }
      return {
        json: async () => DEMO_SPEC,
      };
    }) as typeof globalThis.fetch;
    setHasMockedFetch(true);

    return () => {
      globalThis.fetch = originalFetch;
    };
  }, []);

  if (!hasMockedFetch) {
    return <></>;
  }

  return (
    <OpenAPIProvider specUrl={DEMO_SPEC_URL}>
      <OpenAPIContextDemoBody />
    </OpenAPIProvider>
  );
};

export const OpenAPIContextStories = (): React.ReactElement => {
  return <OpenAPIContextStoriesBody />;
};

export const OpenAPIContextDemo = (): React.ReactElement => {
  return <OpenAPIContextStoriesBody />;
};
