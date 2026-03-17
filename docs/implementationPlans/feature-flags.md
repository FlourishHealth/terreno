# Implementation Plan: Feature Flags & A/B Testing

*When an engineer is assigned to a project but before you begin coding, you should fill in the implementation plan and get feedback from the engineering team. Once you have finished or you make any changes, tag Josh with the @ symbol so he can review. Also tag anyone else that needs to be notified, has conflicting work, etc.*

## **Models**

### FeatureFlag

Admin-managed feature flag definitions with targeting rules and A/B test variant configuration.

```typescript
const featureFlagSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    description: "Unique identifier for the flag, e.g., 'new-checkout-flow'",
  },
  name: {
    type: String,
    required: true,
    description: "Human-readable display name",
  },
  description: {
    type: String,
    default: "",
    description: "Explanation of what this flag controls",
  },
  enabled: {
    type: Boolean,
    default: false,
    description: "Global kill switch — if false, flag is off for everyone",
  },
  type: {
    type: String,
    enum: ["boolean", "variant"],
    default: "boolean",
    description: "Boolean toggle or multi-variant A/B test",
  },
  variants: [{
    key: {
      type: String,
      required: true,
      description: "Variant identifier, e.g., 'control', 'variant-a'",
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      description: "Percentage weight for assignment (0-100, all must sum to 100)",
    },
  }],
  rules: [{
    field: {
      type: String,
      description: "User field to match against, e.g., 'email', 'admin', 'plan'",
    },
    operator: {
      type: String,
      enum: ["eq", "neq", "in", "nin", "gt", "lt", "contains"],
      description: "Comparison operator for field-based rules",
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      description: "Value to compare against (string, number, boolean, or array for in/nin)",
    },
    segment: {
      type: String,
      description: "Name of a registered segment function, e.g., 'pro-users'",
    },
    enabled: {
      type: Boolean,
      description: "For boolean flags: override value when rule matches",
    },
    variant: {
      type: String,
      description: "For variant flags: forced variant key when rule matches",
    },
  }],
  rolloutPercentage: {
    type: Number,
    default: 100,
    min: 0,
    max: 100,
    description: "For boolean flags with no matching rules: percentage of users who get true",
  },
}, {strict: true, toJSON: {virtuals: true}, toObject: {virtuals: true}});

featureFlagSchema.plugin(createdUpdatedPlugin);
featureFlagSchema.plugin(isDeletedPlugin);
featureFlagSchema.plugin(findExactlyOne);
featureFlagSchema.plugin(findOneOrNone);

featureFlagSchema.index({key: 1}, {unique: true});
featureFlagSchema.index({enabled: 1});
```

**Pre-save validation:** For variant-type flags, validate that `variants` is non-empty and weights sum to 100. Throw APIError if invalid.

### FlagAssignment

Sticky A/B test variant assignments per user per flag.

```typescript
const flagAssignmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    description: "User assigned to this variant",
  },
  flagKey: {
    type: String,
    required: true,
    description: "Feature flag key this assignment belongs to",
  },
  variant: {
    type: String,
    required: true,
    description: "Assigned variant key",
  },
}, {strict: true, toJSON: {virtuals: true}, toObject: {virtuals: true}});

flagAssignmentSchema.plugin(createdUpdatedPlugin);
flagAssignmentSchema.plugin(findExactlyOne);
flagAssignmentSchema.plugin(findOneOrNone);

flagAssignmentSchema.index({userId: 1, flagKey: 1}, {unique: true});
flagAssignmentSchema.index({flagKey: 1});
```

## **APIs**

### FeatureFlagsApp Plugin Routes

All routes mounted under configurable `basePath` (default: `/feature-flags`).

#### Admin Routes (IsAdmin)

| Method | Path | Type | Description |
|--------|------|------|-------------|
| POST | `/flags` | modelRouter | Create feature flag |
| GET | `/flags` | modelRouter | List flags (paginated, sortable) |
| GET | `/flags/:id` | modelRouter | Get single flag |
| PATCH | `/flags/:id` | modelRouter | Update flag |
| DELETE | `/flags/:id` | modelRouter | Soft-delete flag |
| GET | `/assignments` | modelRouter | List assignments (filterable by flagKey) |
| DELETE | `/assignments/:id` | modelRouter | Delete assignment (reset a user's variant) |
| GET | `/segments` | custom | List registered segment function names |

#### User Routes (IsAuthenticated)

| Method | Path | Type | Description |
|--------|------|------|-------------|
| GET | `/evaluate` | custom | Evaluate all enabled flags for current user |

**`GET /evaluate` response:**
```json
{
  "data": {
    "new-checkout-flow": true,
    "checkout-experiment": "variant-a",
    "dark-mode": false
  }
}
```

**`GET /segments` response:**
```json
{
  "data": ["pro-users", "beta-testers", "high-usage", "internal-team"]
}
```

### Plugin Constructor

```typescript
interface FeatureFlagsOptions {
  basePath?: string;                              // Default: "/feature-flags"
  segments?: Record<string, (user: any) => boolean>;  // Named segment functions
}

class FeatureFlagsApp implements TerrenoPlugin {
  constructor(options?: FeatureFlagsOptions);
  register(app: express.Application): void;
}
```

### Evaluation Logic

1. Fetch all enabled FeatureFlags
2. For each flag, evaluate `rules` in order:
   - **Field rule:** Compare `user[rule.field]` against `rule.value` using `rule.operator`
   - **Segment rule:** Call `segments[rule.segment](user)` — match if returns true; log warning if segment not found
   - First matching rule → return `rule.enabled` (boolean) or `rule.variant` (variant)
3. If no rules match:
   - **Boolean flags:** Deterministic hash of `userId + flagKey` mod 100, compare against `rolloutPercentage`
   - **Variant flags:** Look up existing `FlagAssignment` for this user+flag. If none, create one using weighted random selection based on variant weights.
4. If flag is disabled: return `false` for boolean, `null` for variant

### Consumer Registration

```typescript
// In consumer's server.ts
const segments = {
  "pro-users": (user) => user.plan === "pro",
  "beta-testers": (user) => user.betaTester === true,
  "high-usage": (user) => user.totalActions > 1000,
  "internal-team": (user) => user.email?.endsWith("@mycompany.com"),
};

new TerrenoApp({userModel: User})
  .register(new FeatureFlagsApp({ segments }))
  .register(new AdminApp({
    models: [
      {
        model: FeatureFlag,
        routePath: "/feature-flags",
        displayName: "Feature Flags",
        listFields: ["key", "name", "type", "enabled", "created"],
      },
      {
        model: FlagAssignment,
        routePath: "/flag-assignments",
        displayName: "Flag Assignments",
        listFields: ["userId", "flagKey", "variant", "created"],
      },
    ],
  }))
  .start();
```

## **Notifications**

None needed.

## **UI**

No new dedicated screens. Feature flags are managed through the existing AdminApp generic form by registering the FeatureFlag and FlagAssignment models.

### Frontend Hook (`@terreno/rtk`)

```typescript
// useFeatureFlags.ts — new file in @terreno/rtk
export const useFeatureFlags = (api: Api<any, any, any, any>, basePath = "/feature-flags") => {
  // Injects GET /feature-flags/evaluate endpoint
  // Returns { useFlag, useVariant, isLoading, error, refetch }
};

// Consumer usage
const { useFlag, useVariant } = useFeatureFlags(terrenoApi);

const showNewCheckout = useFlag("new-checkout-flow");       // true | false
const variant = useVariant("checkout-experiment");           // "control" | "variant-a" | null
```

Fetches once on mount, caches via RTK Query, refetches on window focus.

## Phases

### Phase 1: Backend package + evaluation engine
- Create `feature-flags/` package directory with package.json, tsconfig
- Implement FeatureFlag and FlagAssignment models
- Implement FeatureFlagsApp plugin with modelRouter CRUD
- Implement evaluation engine (field rules, segment rules, rollout hashing, variant assignment)
- Implement `/evaluate`, `/segments` custom endpoints
- Unit tests for evaluation logic

### Phase 2: Frontend hook
- Add `useFeatureFlags()` hook to `@terreno/rtk`
- Export from rtk index

### Phase 3: Example app integration
- Wire up FeatureFlagsApp in example-backend
- Register models in AdminApp
- Add sample flags and use `useFeatureFlags()` in example-frontend
- Regenerate SDK

## Feature Flags & Migrations

No feature flag needed for this feature itself — it's a new package with no existing behavior to gate. No data migrations required.

## Activity Log & User Updates

None needed.

## **Not included/Future work**

- Real-time flag updates via WebSocket (polling/refetch-on-focus only for v1)
- A/B test analytics or conversion tracking (consumers use their own analytics system)
- Custom admin UI for targeting rule editing (generic form only; consumers can extend)
- Async segment functions (sync only for v1; can be added if DB-lookup segments are needed)
- Flag scheduling (enable/disable at a future date)
- Mutual exclusion groups for experiments
- Flag audit log (who changed what, when)
- Flag environments (dev/staging/prod)
