import {Box, Page, Text, Spinner{additionalImports}} from "@terreno/ui";

import type React from "react";

{hookImports}{sdkHooks}} from "@/store";

const {{Name}}Screen: React.FC = () => {queryHooks

  if (isLoading) {
    return (
      <Page navigation={undefined} title="{{title}}">
        <Box alignItems="center" flex="grow" justifyContent="center" padding={4}>
          <Spinner />
        </Box>
      </Page>
    );
  }

  if (error) {
    return (
      <Page navigation={undefined} title="{{title}}">
        <Box padding={4}>
          <Text color="error">Failed to load {{lowerName}}</Text>
        </Box>
      </Page>
    );
  }

  return (
    <Page navigation={undefined} title="{{title}}">
      <Box gap={4} padding={4}>
        {{screenContent}}
      </Box>
    </Page>
  );
};

export default {{Name}}Screen;
