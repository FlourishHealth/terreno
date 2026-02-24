# Screen Generation

Create a new screen with the following specifications:

## Screen Details
- **Name**: {{name}}
- **Type**: {{type}}
- **Route**: {{route}}

## Features
{{featuresList}}

## Implementation Requirements

### File Structure
- Create screen at `app/{{route}}.tsx`
- Add any shared components to `components/`

### Required Elements
1. Use `Page` component as wrapper
2. Include proper navigation title
3. Handle loading states with `Spinner`
4. Handle error states with appropriate messaging
5. Use @terreno/ui components throughout

### Data Fetching
{{dataSection}}

### Example Structure
```tsx
import {Box, Page, Text, Spinner} from "@terreno/ui";
import type React from "react";
import {useGet{{Model}}Query} from "@/store";

const {{Name}}Screen: React.FC = () => {
  const {data, isLoading, error} = useGet{{Model}}Query();

  if (isLoading) {
    return (
      <Page navigation={undefined} title="{{title}}">
        <Box padding={4} alignItems="center">
          <Spinner />
        </Box>
      </Page>
    );
  }

  if (error) {
    return (
      <Page navigation={undefined} title="{{title}}">
        <Box padding={4}>
          <Text color="error">Failed to load data</Text>
        </Box>
      </Page>
    );
  }

  return (
    <Page navigation={undefined} title="{{title}}">
      <Box padding={4} gap={4}>
        {/* Screen content */}
      </Box>
    </Page>
  );
};

export default {{Name}}Screen;
```

### Navigation
- Add to tab layout if needed in `app/(tabs)/_layout.tsx`
- Or add as stack screen in appropriate layout
