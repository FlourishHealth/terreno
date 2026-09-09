# Forms — @terreno/ui

All form fields share common props:

```typescript
interface BaseFieldProps {
  onChange: (value: string) => void;
  value?: string;
  title?: string;        // label above field
  placeholder?: string;
  disabled?: boolean;
  errorText?: string;    // red error below field
  helperText?: string;   // gray helper below field
  iconName?: IconName;
  testID?: string;
}
```

## TextField

```tsx
<TextField
  title="Name"
  value={name}
  onChange={setName}
  type="text"            // text | email | password | phoneNumber | search | url
  errorText={nameError}
  helperText="Required"
  multiline
  rows={3}
  grow                   // auto-expand height
  trimOnBlur
/>
```

## SelectField

```tsx
<SelectField
  title="Status"
  options={[
    {label: "Active", value: "active"},
    {label: "Inactive", value: "inactive"},
  ]}
  value={status}
  onChange={setStatus}
  requireValue
/>
```

## DateTimeField

```tsx
import {DateTime} from "luxon";

<DateTimeField
  title="Due Date"
  type="date"            // date | datetime | time
  value={dueDate}        // ISO string
  onChange={setDueDate}
  showTimezone
/>
```

Always use Luxon for formatting displayed dates.

## Other fields

| Field | Use for |
|-------|---------|
| `TextArea` | Multi-line text |
| `NumberField` | Numeric input |
| `EmailField` | Email with validation |
| `PhoneNumberField` | Phone formatting |
| `BooleanField` | Toggle with label |
| `CheckBox` | Checkbox without field chrome |
| `RadioField` | Radio group |
| `MultiselectField` | Multiple selection |
| `AddressField` | Structured address |
| `PasswordField` | Password with show/hide |
| `SignatureField` | Draw signature (consent flows) |

## TapToEdit

Use `TapToEdit` for values that should stay read-only until the user taps the pencil. Pass `setValue` for the in-progress edit and `onSave` to persist.

```tsx
<TapToEdit
  onSave={handleSaveName}
  setValue={setName}
  title="Name"
  type="text"
  value={name}
/>
```

`onSave` may be async. Cancel restores the value from when editing started. Do not omit `setValue` when `editable` is true.

## Form pattern

```tsx
const [email, setEmail] = useState<string>("");
const [emailError, setEmailError] = useState<string | undefined>();

const handleSubmit = useCallback(async (): Promise<void> => {
  if (!email.trim()) {
    setEmailError("Email is required");
    return;
  }
  setEmailError(undefined);
  await saveMutation({email}).unwrap();
}, [email, saveMutation]);
```

Check validation at the start of handlers and return early.

## Admin forms

For admin CRUD, use `AdminModelForm` from `@terreno/admin-frontend` — it auto-generates fields from the backend `/admin/config` metadata.
