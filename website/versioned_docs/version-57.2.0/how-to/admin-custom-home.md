# Customize the admin home

Configure home slots on `AdminApp`:

```ts
new AdminApp({
  home: {
    title: "Operations",
    slots: {
      contentTop: ["feature-flags-overrides"],
      main: ["modelStats"],
      navGlobal: ["scriptRunner"],
      sidebar: ["versionConfig", "recentActivity"],
    },
  },
});
```

Built-in IDs include `modelStats`, `modelsGrid`, `scriptRunner`, `versionConfig`, and
`recentActivity`. Plugins add IDs such as `feature-flags-overrides`.

For an app-specific widget, implement `AdminHomeWidgetProps` and register it:

```tsx
<AdminProvider widgets={{home: {operationsSummary: OperationsSummary}}} api={api}>
  <AdminHome api={api} />
</AdminProvider>
```

Then place `"operationsSummary"` in a home slot. Unknown IDs render a visible missing-widget
placeholder in development instead of crashing the dashboard.
