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

## Testing Utilities

@terreno/ui provides test helpers for writing component tests with @testing-library/react-native.

### renderWithTheme

Wraps components in ThemeProvider for testing.

``````typescript
import {renderWithTheme} from "@terreno/ui";
import {describe, it, expect} from "bun:test";

describe("MyComponent", () => {
  it("renders correctly", () => {
    const {getByTestId} = renderWithTheme(<MyComponent testID="my-comp" />);
    expect(getByTestID("my-comp")).toBeTruthy();
  });
});
``````

**Why:** Most @terreno/ui components require ThemeProvider context to access theme values.

### createCommonMocks

Creates mock functions for common component callbacks.

``````typescript
import {createCommonMocks} from "@terreno/ui";

const mocks = createCommonMocks();
// Returns: {onBlur, onChange, onEnter, onFocus, onIconClick, onSubmitEditing}

<TextField
  value="test"
  onChange={mocks.onChange}
  onBlur={mocks.onBlur}
  onFocus={mocks.onFocus}
/>

// Assert mock was called
expect(mocks.onChange).toHaveBeenCalledWith("new value");
``````

### setupComponentTest / teardownComponentTest

Lifecycle helpers for test setup and cleanup.

``````typescript
import {setupComponentTest, teardownComponentTest} from "@terreno/ui";

describe("MyForm", () => {
  let mocks;

  beforeEach(() => {
    mocks = setupComponentTest(); // Returns createCommonMocks()
  });

  afterEach(() => {
    teardownComponentTest(); // No-op in Bun (auto-cleanup)
  });

  it("submits form", () => {
    // Test with mocks
  });
});
``````

## Date Utilities

Luxon-based helpers for date comparison and formatting.

``````typescript
import {
  isToday,
  isTomorrow,
  isYesterday,
  isThisYear,
  isWithinWeek,
  getIsoDate,
} from "@terreno/ui";

const date = DateTime.now();

if (isToday(date)) console.log("Today!");
if (isTomorrow(date)) console.log("Tomorrow!");
if (isYesterday(date)) console.log("Yesterday!");
if (isThisYear(date)) console.log("This year!");
if (isWithinWeek(date)) console.log("Within 7 days!");

// Convert to ISO date string
const isoString = getIsoDate(date); // "2026-02-15"
``````

### Timezone Utilities

``````typescript
import {getTimezoneOptions} from "@terreno/ui";

// Get USA timezones only
const usaTimezones = getTimezoneOptions("usa");
// Returns: [{label: "Pacific Time", value: "America/Los_Angeles"}, ...]

// Get worldwide timezones
const allTimezones = getTimezoneOptions("worldwide");
// Returns: [{label: "UTC", value: "UTC"}, {label: "New York", value: "America/New_York"}, ...]
``````

**Use case:** Populate SelectField with timezone choices.

## Address Utilities

Google Places API integration helpers for address handling.

### formatAddress

``````typescript
import {formatAddress} from "@terreno/ui";

const address = {
  street: "123 Main St",
  city: "San Francisco",
  state: "CA",
  zipCode: "94102",
};

const formatted = formatAddress(address);
// "123 Main St, San Francisco, CA 94102"
``````

### processAddressComponents

Parses Google Places API address_components into structured data.

``````typescript
import {processAddressComponents} from "@terreno/ui";

// From Google Places API response
const components = place.address_components;

const parsed = processAddressComponents(components);
// Returns: {street, city, state, zipCode, country, county}
``````

### findAddressComponent

``````typescript
import {findAddressComponent} from "@terreno/ui";

const city = findAddressComponent(components, "locality");
const state = findAddressComponent(components, "administrative_area_level_1", "short_name");
``````

### Validation

``````typescript
import {isValidGoogleApiKey, formattedCountyCode} from "@terreno/ui";

if (!isValidGoogleApiKey(apiKey)) {
  console.error("Invalid Google API key");
}

// Format US county codes
const county = formattedCountyCode("6075"); // "6075" (Santa Cruz County, CA)
``````

## Media Query Helpers

Responsive design utilities for breakpoints and device detection.

``````typescript
import {
  mediaQuery,
  mediaQueryLargerThan,
  mediaQuerySmallerThan,
  isMobileDevice,
} from "@terreno/ui";

// Check if matches breakpoint
if (mediaQuery("md")) {
  console.log("Medium or larger");
}

// Greater than breakpoint
if (mediaQueryLargerThan("sm")) {
  console.log("Larger than small");
}

// Smaller than breakpoint
if (mediaQuerySmallerThan("lg")) {
  console.log("Smaller than large");
}

// Detect mobile
if (isMobileDevice()) {
  console.log("Running on mobile device");
}
``````

**Breakpoints:**
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px

## Icons

### FontAwesome Icons

All 2000+ FontAwesome 6 icons available via the `Icon` component:

``````typescript
import {Icon} from "@terreno/ui";

<Icon name="check" size={24} color="primary" />
<Icon name="user" size={32} color="secondary" />
<Icon name="chevron-right" size={16} color="neutral700" />
``````

### Custom SVG Icons

@terreno/ui includes custom status icons:

``````typescript
import {MobileIcon, OnlineIcon, OfflineIcon, OutOfOfficeIcon} from "@terreno/ui";

<MobileIcon width={20} height={20} fill="#007AFF" />
<OnlineIcon width={16} height={16} />
<OfflineIcon width={16} height={16} />
<OutOfOfficeIcon width={16} height={16} />
``````

**Use case:** User status indicators, device type badges.

## Style Utilities

### Unifier Class

Color manipulation helper:

``````typescript
import {Unifier} from "@terreno/ui";

// Darken/lighten colors
const darkColor = Unifier.changeColorLuminance("#007AFF", -0.2); // Darker
const lightColor = Unifier.changeColorLuminance("#007AFF", 0.2); // Lighter
``````

### Style Helpers

``````typescript
import {identity, concat, fromClassName, toggle, binding, union} from "@terreno/ui";

// Compose style objects
const styles = concat(baseStyles, conditionalStyles);

// Toggle styles
const buttonStyles = toggle(isPressed, pressedStyles, defaultStyles);
``````

**Note:** Most use cases are better served by Box props (`padding`, `color`, etc.).

See the [ui package source](../../ui/src/) and [.cursor/rules/ui/](../../.cursor/rules/ui/) for props and conventions.
