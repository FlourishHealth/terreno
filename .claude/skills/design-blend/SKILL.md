---
name: design-blend
description: >-
  Build a Terreno implementation from a Claude design file using REST-first
  backend rules, Terreno-first UI mapping, and mandatory
  plan-confirm-then-subagent execution.
---
# Design Blend

Use this skill when converting a Claude design file into an implementation-ready Terreno plan and execution workflow.

## Non-negotiable contract

1. **REST-first backend design is mandatory.**
   - Every persistent entity MUST map to a model and a `modelRouter` CRUD plan first.
   - Custom actions are forbidden unless they pass the Action Decision Gate.
2. **Action gating is mandatory and auditable.**
   - You MUST track both approved and rejected action candidates.
   - If rejected candidates are missing, the output is invalid.
3. **Terreno-first UI composition is mandatory.**
   - You MUST map each design section to existing `@terreno/ui` components before proposing new components.
4. **New components are conditional, never default.**
   - A new component is allowed only if a concrete composition gap is proven.
5. **Plan confirmation is mandatory before implementation.**
   - You MUST produce a plan and task list and wait for explicit user confirmation.
6. **Subagent-driven implementation is mandatory.**
   - After confirmation, execution MUST be delegated task-by-task to a subagent.
7. **Per-task Plan vs Actual reporting is mandatory.**
   - After each task, publish a Plan vs Actual record with status: `match`, `partial`, or `deviation`.

If any mandatory item above is skipped, stop and correct before proceeding.

## Required outputs

You MUST output the following sections in order.

### 1) Model Inventory (required)

For each inferred entity:

- `modelName`
- `fields` (`name`, `type`, `required`, `default`, `description`)
- `relations` (`ref`, cardinality)
- `indexes`
- `plugins`
- ownership/multitenancy notes (`ownerId`, tenant key, soft delete)

Required artifacts:

1. **Model Inventory** table.
2. **Per-model schema checklist**.
3. **No model needed rationale** for presentational-only sections.

### 2) REST Endpoint Matrix (required)

For each model, define a `modelRouter` plan:

- base path
- CRUD endpoints:
  - `POST /resource`
  - `GET /resource`
  - `GET /resource/:id`
  - `PATCH /resource/:id`
  - `DELETE /resource/:id` (or explicit disable reason)
- `permissions` by method
- `queryFields`
- `queryFilter` (ownership/tenant filter when relevant)
- `sort`
- `populatePaths` when needed

Required artifacts:

1. **REST Endpoint Matrix** table (`method`, `path`, `permission`, `purpose`).
2. **modelRouter Options Block** for each model.
3. Explicit CRUD disable rationale when applicable.

### 3) Action Decision Gate (strict, conditional)

Action candidates are only eligible if at least one is true:

1. non-resource command semantics (`publish`, `approve`, `submit`, `duplicate`)
2. aggregation/read-model shape not efficiently expressible by CRUD
3. performance path with measurable benefit

For each action candidate, produce:

- `actionName`
- `method` + `path`
- `whyRestIsInsufficient` (mandatory)
- `requestSchema` + `responseSchema`
- `permissions`
- `performanceNote` (mandatory for performance-motivated actions)

Required artifacts:

1. **Action Decision Gate checklist**.
2. **Approved Actions** table.
3. **Rejected Candidate Actions** table (mandatory, even if empty use "none rejected" explicitly).

### 4) Terreno Component Mapping (required)

For every screen and state:

- map sections to existing `@terreno/ui` components first (`Page`, `Box`, `Card`, `DataTable`, `TextField`, `SelectField`, `Button`, `Modal`, `Spinner`, `Toast`, etc.)
- include loading, empty, error, success states
- include navigation and interaction flow

Required artifacts:

1. **Terreno Component Mapping** table by screen section.
2. **State Coverage Matrix** (`loading`, `empty`, `error`, `success`).
3. **Accessibility/Testability Notes** (`testID`, semantics).

### 5) New Component Contract (strictly conditional)

New component proposal is forbidden unless a proven gap exists.

Proof requirements:

1. attempted composition with existing `@terreno/ui` components
2. explicit mismatch/gap explanation
3. why wrappers/props/slotting are insufficient

If approved, require:

- `componentName`
- `whyExistingTerrenoComponentsDoNotFit`
- `propsApi`
- `states`
- `reusabilityTargets` (at least one additional use case)

Required artifacts:

1. **New Component Candidates** table.
2. **Approved New Components** API contract section.
3. **Rejected Candidate Components** section with fallback composition.

## Execution workflow (deterministic)

### Phase A: Planning only

1. Parse design file and assumptions.
2. Produce required outputs from sections 1-5.
3. Produce a structured task list with dependencies and acceptance criteria.
4. Ask for explicit confirmation:
   - "Confirm plan and task list. Reply `approved` to start implementation."
5. If confirmation is not explicit, do not implement.

### Phase B: Implementation only after confirmation

1. Execute tasks strictly in dependency order.
2. Delegate each task to a subagent with:
   - task scope
   - expected files
   - acceptance criteria
   - test requirements
3. After each completed task, publish:

```markdown
### Plan vs Actual: Task <id>
- Status: match | partial | deviation
- Planned:
  - <planned outcomes>
- Actual:
  - <implemented outcomes>
- Evidence:
  - <tests, commands, artifacts>
- Corrective action:
  - <required follow-up, or "none">
```

4. If status is `partial` or `deviation`, update remaining tasks before continuing.

## Mandatory quality checks before final handoff

Do not finalize until all checks pass:

- [ ] Model Inventory and schema checklists are present.
- [ ] REST Endpoint Matrix and modelRouter options are present for every model.
- [ ] Action Decision Gate includes approved and rejected candidate tracking.
- [ ] Terreno Component Mapping and State Coverage Matrix are present.
- [ ] Any new component has proven-gap evidence and API contract.
- [ ] User explicitly confirmed plan + task list before implementation.
- [ ] Implementation was subagent-driven task-by-task.
- [ ] Every implemented task has a Plan vs Actual entry.

If any box is unchecked, final output is invalid and must be corrected.
