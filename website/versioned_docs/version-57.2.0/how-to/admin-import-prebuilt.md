# Import pre-built admins

Register first-party plugins on the same `TerrenoApp` as `AdminApp`:

```ts
const app = new TerrenoApp({userModel: User})
  .register(new FeatureFlagsApp())
  .register(new ConsentApp({auditTrail: true}))
  .register(new DocumentStorageApp({bucketName: process.env.GCS_BUCKET ?? ""}))
  .register(new AIAdminApp())
  .register(new AdminApp({home: {slots: {main: ["modelStats"]}}}));
```

`AdminApp` aggregates each plugin's `adminContribution()`:

- `FeatureFlagsApp`: FeatureFlag model and `feature-flags-overrides` home widget.
- `ConsentApp`: ConsentForm and ConsentResponse models plus consent field-widget IDs.
- `DocumentStorageApp`: `documents` custom screen.
- `AIAdminApp`: `ai-requests` custom screen and explorer API.

Wrap frontend admin routes in `AdminProvider`. First-party widgets are already in the built-in
registry, so no consumer-side switch statement or custom-screen map is required.

`featureFlagAdminConfig` and `AdminApp.models` remain compatibility paths, but new integrations
should use plugin contributions and `modelRouter({admin: ...})`.
