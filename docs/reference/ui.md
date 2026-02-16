# @terreno/ui

React Native UI component library (88+ components). Layout (Box, Page, Card), forms (TextField, SelectField), display (Text, DataTable), actions (Button), feedback (Modal, Toast), and theming via TerrenoProvider.

## Key exports

- Layout: `Box`, `Page`, `SplitPage`, `Card`
- Forms: `TextField`, `SelectField`, `DateTimeField`, `CheckBox`
- Display: `Text`, `Heading`, `Badge`, `DataTable`
- Actions: `Button`, `IconButton`, `Link`
- Feedback: `Spinner`, `Modal`, `Toast`
- Theming: `TerrenoProvider`, `useTheme`
- **Type re-exports:** `StyleProp`, `ViewStyle` (re-exported from react-native to avoid version conflicts)

## Type Re-exports

@terreno/ui re-exports commonly-used React Native types to help consumers avoid version conflicts:

``````typescript
import {StyleProp, ViewStyle} from "@terreno/ui";

// Use these instead of importing from react-native directly
const customStyle: StyleProp<ViewStyle> = {
  flex: 1,
  backgroundColor: "#fff",
};
``````

**Benefits:**
- Avoids version mismatches between your app's react-native and @terreno/ui's react-native
- Ensures type compatibility when passing styles to @terreno/ui components
- Simplifies imports (one package instead of two)

## Component Behaviors

### Button Layout Behavior

Buttons automatically size to their content unless `fullWidth` is specified:

``````typescript
// Button takes only the space it needs
<Box direction="column">
  <Button text="Save" onClick={handleSave} />  {/* Auto-sized */}
</Box>

// Button stretches to full width
<Box direction="column">
  <Button text="Save" onClick={handleSave} fullWidth />  {/* Full width */}
</Box>
``````

Internally, Button sets `alignSelf: 'flex-start'` when `fullWidth={false}` to prevent stretching in column layouts.

See the [ui package source](../../ui/src/) and [.cursor/rules/ui/](../../.cursor/rules/ui/) for props and conventions.
