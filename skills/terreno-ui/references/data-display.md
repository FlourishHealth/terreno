# Data Display — @terreno/ui

## Text and Heading

```tsx
<Text size="md" color="primary" bold truncate>
  Body copy
</Text>

<Heading size="lg" color="primary" align="center">
  Page Title
</Heading>
```

Sizes: `sm`, `md`, `lg`, `xl`, `2xl` (responsive web/mobile values).

## Badge

```tsx
<Badge status="success" value="Active" />
<Badge status="warning" value="Pending" />
<Badge status="error" value="Failed" />
```

## DataTable

```tsx
<DataTable
  columns={[
    {key: "name", label: "Name", width: 200, sortable: true},
    {key: "status", label: "Status", width: 100, columnType: "boolean"},
    {key: "created", label: "Created", width: 150, columnType: "date"},
  ]}
  data={rows}
  onSortChange={setSort}
  onRowClick={(row) => navigate(row.id)}
  pageSize={20}
  totalRowCount={total}
  onPageChange={setPage}
  sticky
  loading={isLoading}
/>
```

Column types: `text`, `date`, `number`, `boolean`, `custom`.

For admin tables, prefer `AdminModelTable` from `@terreno/admin-frontend`.

## Link

```tsx
<Link href="https://example.com" text="Learn more" />
```

## Avatar

```tsx
<Avatar name="Jane Doe" src={imageUrl} size="md" />
```

## Pagination

Standalone pagination when not using DataTable's built-in controls:

```tsx
<Pagination
  page={currentPage}
  totalPages={totalPages}
  onPageChange={setPage}
/>
```

## Date formatting

Always use Luxon:

```tsx
import {DateTime} from "luxon";

const formatted = DateTime.fromISO(isoString).toLocaleString(DateTime.DATETIME_MED);
```

## Selectable text

Add `selectable` to `Text` when users may copy the content (IDs, error messages, data values).
