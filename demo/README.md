# Terreno Demo

Interactive showcase and development sandbox for @terreno/ui components. Built with Expo Router.

## Purpose

This app serves multiple purposes:

1. **Component Gallery**: Interactive showcase of all @terreno/ui components
2. **Development Sandbox**: Test components during development
3. **Visual Regression Testing**: Verify component appearance across platforms
4. **Documentation by Example**: Live examples of component usage

## Features

- **88+ Components**: Complete @terreno/ui component library
- **Two Modes**: 
  - Demo mode: Polished component showcase
  - Dev mode: Raw component testing and manipulation
- **Cross-platform**: Web, iOS, and Android support
- **Hot Reload**: Instant updates during development
- **Theme System**: Test components with different themes

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) installed
- For iOS: macOS with Xcode
- For Android: Android Studio with emulator

### Installation

```bash
# From monorepo root
bun install

# Or from demo directory
cd demo
bun install
```

### Running the App

```bash
# From monorepo root
bun run demo:start    # Start Expo dev server

# Platform-specific
bun run demo:web      # Web browser
bun run demo:ios      # iOS simulator
bun run demo:android  # Android emulator
```

Or from the demo directory:

```bash
bun run start         # Start dev server
bun run web           # Web
bun run ios           # iOS
bun run android       # Android
```

The app runs on port 8085 by default.

## App Structure

```
app/
  _layout.tsx          # Root layout with theme provider
  demo/
    _layout.tsx        # Demo mode layout
    index.tsx          # Component grid
    [component].tsx    # Dynamic component demo route
  dev/
    _layout.tsx        # Dev mode layout
    index.tsx          # Dev home page
    [component].tsx    # Dynamic dev route
components/
  DemoHomePage.tsx     # Home page component grid
  DevHomePage.tsx      # Developer mode home
  ErrorBoundary.tsx    # Error handling wrapper
stories/
  *.stories.tsx        # Component demo/story files
demoConfig.tsx         # Route configuration
```

## Two Modes

### Demo Mode (Default)

User-facing component showcase with polished examples:

- Clean UI with component cards
- Multiple variants per component
- Real-world usage examples
- Organized by category

Access at: `/demo/[component]`

### Dev Mode

Developer-focused testing environment:

- Raw component manipulation
- Quick iteration during development
- Less polished, more experimental

Access via: Header button → `/dev/[component]`

## Adding a Component Demo

### 1. Create a Story File

Create `stories/MyComponent.stories.tsx`:

```typescript
import React from "react";
import {Box, Text, MyComponent} from "@terreno/ui";

export const MyComponentDemo: React.FC = () => (
  <Box padding={4} gap={4}>
    <Text size="lg">MyComponent Demo</Text>
    
    {/* Default variant */}
    <Box gap={2}>
      <Text>Default</Text>
      <MyComponent />
    </Box>
    
    {/* Disabled variant */}
    <Box gap={2}>
      <Text>Disabled</Text>
      <MyComponent disabled />
    </Box>
    
    {/* Error state */}
    <Box gap={2}>
      <Text>Error State</Text>
      <MyComponent error="Something went wrong" />
    </Box>
  </Box>
);
```

### 2. Register in Demo Config

Add to `demoConfig.tsx`:

```typescript
import {MyComponentDemo} from "./stories/MyComponent.stories";

export const demoConfig = {
  // ... existing components
  "my-component": MyComponentDemo,
};
```

### 3. Test

Navigate to `/demo/my-component` to see your demo.

## Development Scripts

```bash
# Development
bun run start          # Start Expo dev server
bun run web            # Start web version
bun run ios            # iOS simulator
bun run android        # Android emulator

# Code Quality
bun run compile        # Type check
bun run lint           # Lint code
bun run lint:fix       # Fix lint issues

# Expo
bun run export         # Export static web build
bun run reset-cache    # Clear Metro bundler cache
```

## Component Demo Best Practices

### Show Multiple States

Always demonstrate:
- Default state
- Loading state
- Error state
- Disabled state
- Interactive states (hover, focus, active)

```typescript
export const ButtonDemo: React.FC = () => (
  <Box gap={4}>
    <Button text="Default" onClick={() => {}} />
    <Button text="Loading" onClick={() => {}} loading />
    <Button text="Disabled" onClick={() => {}} disabled />
    <Button text="With Icon" onClick={() => {}} iconName="check" />
  </Box>
);
```

### Use Real Data

Use realistic examples, not "Lorem ipsum" or "Test":

```typescript
// Good
<TextField value="john.doe@example.com" title="Email" />

// Avoid
<TextField value="test" title="Test Field" />
```

### Add Context

Include explanatory text:

```typescript
<Box gap={4}>
  <Text>Buttons come in 4 variants:</Text>
  <Button text="Primary" variant="primary" onClick={() => {}} />
  <Button text="Secondary" variant="secondary" onClick={() => {}} />
  <Button text="Outline" variant="outline" onClick={() => {}} />
  <Button text="Ghost" variant="ghost" onClick={() => {}} />
</Box>
```

### Test Responsiveness

Show how components adapt to different screen sizes:

```typescript
<Box gap={4}>
  <Box smDirection="column" mdDirection="row" gap={2}>
    <Button text="Button 1" onClick={() => {}} />
    <Button text="Button 2" onClick={() => {}} />
  </Box>
</Box>
```

## Troubleshooting

### Port Already in Use

Demo runs on port 8085. If it's in use:

```bash
# Find and kill the process
lsof -ti:8085 | xargs kill

# Or use a different port
EXPO_DEVSERVER_PORT=8090 bun run start
```

### Metro Bundler Cache Issues

```bash
bun run reset-cache
bun run start
```

### Component Not Showing

1. Check that the story file is in `stories/`
2. Verify it's registered in `demoConfig.tsx`
3. Ensure the component is exported from `@terreno/ui`
4. Check browser console for errors

### iOS/Android Build Errors

```bash
# Clear watchman cache
watchman watch-del-all

# Clear Expo cache
rm -rf .expo

# Reinstall dependencies
rm -rf node_modules
bun install
```

## Testing Components

The demo app is also used for visual regression testing:

1. Make changes to a @terreno/ui component
2. Run the demo app: `bun run demo:start`
3. Navigate to the component's demo
4. Verify appearance on all platforms (web, iOS, Android)
5. Check different theme modes (light/dark)

## Deployment

The demo app is automatically deployed to Google Cloud Storage on push to master:

- **Production**: Deployed from `demo/` directory changes
- **PR Previews**: Deployed to `_previews/pr-{number}/`
- **URL**: https://demo.terreno.flourish.health (configured via CDN)

See [GCP Static Site Hosting](../README.md#gcp-static-site-hosting) for details.

## Component Coverage

The demo showcases all @terreno/ui components:

**Layout**: Box, Page, SplitPage, Card, Body, ImageBackground

**Text**: Text, Heading, Link, Hyperlink

**Forms**: TextField, TextArea, SelectField, DateTimeField, NumberField, EmailField, PhoneNumberField, CheckBox, RadioField, PasswordField, etc.

**Actions**: Button, IconButton, DismissButton

**Data Display**: DataTable, Pagination, Badge, Avatar

**Feedback**: Modal, Toast, Spinner, ErrorPage, Banner

**Navigation**: Accordion, SideDrawer, SegmentedControl

**Advanced**: Icon, Tooltip, MarkdownView, EmojiSelector, Slider

See [COMPONENT_TEST_COVERAGE.md](../ui/COMPONENT_TEST_COVERAGE.md) for detailed component test coverage.

## Learn More

- [@terreno/ui Documentation](../docs/reference/ui.md)
- [@terreno/ui Package](../ui/README.md)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [React Native Documentation](https://reactnative.dev/)

## Contributing

When adding new components to @terreno/ui:

1. Create the component in `ui/src/`
2. Add a demo in `demo/stories/`
3. Register in `demoConfig.tsx`
4. Test across all platforms
5. Update this README if needed

## License

Apache-2.0
