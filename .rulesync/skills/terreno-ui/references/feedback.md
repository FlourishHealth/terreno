# Feedback — @terreno/ui

## Spinner

```tsx
<Spinner />
<Spinner size="lg" />
```

Use in loading states inside `Page` or centered in `Box`.

## Modal

```tsx
<Modal
  visible={isVisible}
  onDismiss={() => setIsVisible(false)}
  title="Confirm Action"
  size="sm"                          // sm | md | lg
  primaryButtonText="Confirm"
  primaryButtonOnClick={handleConfirm}
  secondaryButtonText="Cancel"
  secondaryButtonOnClick={() => setIsVisible(false)}
  persistOnBackgroundClick={false}
>
  <Text>Are you sure?</Text>
</Modal>
```

Renders as ActionSheet on mobile, centered dialog on web.

## Button confirmation

```tsx
<Button
  text="Delete"
  variant="destructive"
  withConfirmation
  confirmationText="This cannot be undone."
  onClick={handleDelete}
/>
```

## Toast

Toasts are provided by `TerrenoProvider`. Trigger via the toast API exported from `@terreno/ui` (check current exports in `ui/src/index.tsx`).

## Banner

```tsx
<Banner
  text="You are offline. Changes will sync when reconnected."
  status="warning"
/>
```

Use with `OfflineBanner` for network status (see example-frontend todos screen).

## ErrorPage

Full-page error state:

```tsx
<ErrorPage
  title="Something went wrong"
  message="We couldn't load your data."
  onRetry={refetch}
/>
```

## ErrorBoundary

Wrap risky subtrees:

```tsx
<ErrorBoundary>
  <RiskyComponent />
</ErrorBoundary>
```

## Loading + error pattern on Page

```tsx
if (isLoading) {
  return (
    <Page title="Items">
      <Box alignItems="center" padding={8}>
        <Spinner />
      </Box>
    </Page>
  );
}

if (error) {
  return (
    <Page title="Items">
      <ErrorPage title="Failed to load" onRetry={refetch} />
    </Page>
  );
}
```

Never ship a screen without loading and error states.
