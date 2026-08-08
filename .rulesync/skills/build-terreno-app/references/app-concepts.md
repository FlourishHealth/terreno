# App concepts

Five specs for the [`build-terreno-app`](../SKILL.md) harness. Each is chosen to exercise a wide slice of Terreno while staying small enough to finish in one session.

Selection criteria applied to all of them: uses AI in a way that is genuinely useful rather than decorative; is meaningfully better for being on both mobile and web rather than one or the other; has a natural offline story; is explainable in one sentence; and has no more than three or four models.

**Default: [Sprout](#sprout-plant-care-companion-default).** It has the cleanest one-sentence pitch, the most natural AI use, an obvious admin-curated library, and a genuine reason to be offline. Pick a different one when you want to stress a specific capability — [Pantry](#pantry-shared-kitchen) for realtime collaboration, [Recall](#recall-ai-flashcards) for the simplest possible build, [Fieldnote](#fieldnote-site-inspections) for forms and signatures.

---

## Sprout — plant care companion (default)

**One sentence:** Photograph a plant, get its species and a care schedule, then log care as you do it — including in a greenhouse with no signal.

**Why it fits:** the camera is genuinely mobile, the dashboard is genuinely web, plant identification is a real use for AI vision plus structured output, a curated species library is a real use for the admin panel, and gardens and greenhouses have terrible connectivity, which makes local-first a feature rather than a demo.

### Models

| Model | Fields | Notes |
|-------|--------|-------|
| `Species` | `commonName`, `scientificName`, `wateringIntervalDays`, `lightRequirement` (enum), `careNotes` | **Admin-curated.** Read-only to normal users |
| `Plant` | `nickname`, `speciesId` (ref), `photoUrl`, `location`, `acquiredOn`, `ownerId` | Owner-scoped |
| `CareEvent` | `plantId` (ref), `type` (enum: `water`, `fertilize`, `repot`, `prune`), `occurredAt`, `notes`, `ownerId` | The offline-write target |

Every field needs a `description` — it flows into the OpenAPI spec, the typed client, and the admin UI.

### Slices, in order

1. **Species list** — admin-curated model, read-only list screen. Proves CRUD, permissions, and the typed client.
2. **Add a plant** — form with a species picker, owner-scoped create. Proves forms and owner permissions.
3. **Identify from a photo** — upload a photo, call AI with vision, return a structured object matching an existing species or proposing a new one. Proves file upload and structured AI output.
4. **Log care offline** — a one-tap care log that works with the network off and syncs on reconnect. Proves local-first.
5. **Care dashboard (web)** — a table of care history and which plants are overdue, using date math. Proves the web-specific surface and the component library's data display.
6. **Ask about a plant** — streaming AI chat scoped to one plant's species and care history. Proves streaming AI and conversation history.
7. **Admin species library** — admin panel for `Species`, verified inaccessible to a normal user. Proves the admin panel.
8. **Shared collection** — a second user sees a shared plant's care events appear live. Proves realtime.

Gate slice 6 behind a feature flag to exercise flags.

### AI calls

- **Structured output:** photo plus prompt → `{commonName, scientificName, confidence, wateringIntervalDays, lightRequirement, careNotes}`. Use the typed object helper, not free-text parsing.
- **Streaming chat:** plant context (species, recent care events) plus the user's question → streamed answer.

Keep prompts in constants at the top of the file. Use a low temperature for identification and a middling one for chat.

---

## Pantry — shared kitchen

**One sentence:** Photograph what is in your fridge, get recipes you can actually make, and share one shopping list with your household — including inside a grocery store with no signal.

**Why it fits:** the strongest realtime story of the five, because a shared shopping list where two people shop simultaneously is a genuinely multiplayer problem, and conflict resolution becomes something the reader cares about rather than an abstraction. Costs one extra model for the household concept.

### Models

| Model | Fields | Notes |
|-------|--------|-------|
| `Household` | `name`, `memberIds` (array of refs) | Shared-scope root |
| `PantryItem` | `name`, `quantity`, `unit`, `expiresOn`, `householdId` (ref) | Household-scoped |
| `Recipe` | `title`, `ingredients` (array), `steps` (array), `sourceType` (enum: `curated`, `generated`), `createdBy` | Curated ones are admin-managed |
| `ShoppingListItem` | `name`, `quantity`, `checked`, `householdId` (ref) | The realtime and conflict target |

### Slices, in order

1. Pantry list, household-scoped.
2. Add items manually.
3. Photograph the fridge → AI extracts an item array (structured array output).
4. Recipe suggestions from current pantry contents (AI generation against a schema).
5. Shopping list with offline check-off.
6. Two-client realtime: one person checks off an item, the other sees it immediately.
7. Deliberate conflict: both clients edit the same item offline, then reconnect.
8. Admin-curated recipe library.

Slice 7 is the reason to pick this concept — it is the clearest demonstration of what a local-first data layer actually has to solve.

### AI calls

- **Structured array output:** fridge photo → `[{name, quantity, unit}]`.
- **Structured object output:** pantry contents → `{title, ingredients, steps, missingIngredients}`.

---

## Recall — AI flashcards

**One sentence:** Paste anything you want to learn, get a deck of cards, and study it on the subway.

**Why it fits:** the smallest possible build that still demonstrates AI plus offline plus universal. Choose it when validating a documentation change quickly rather than doing a full capability sweep. Weakest admin and realtime story of the five.

### Models

| Model | Fields |
|-------|--------|
| `Deck` | `title`, `sourceText`, `ownerId` |
| `Card` | `deckId` (ref), `front`, `back`, `dueOn`, `intervalDays`, `easeFactor`, `ownerId` |

### Slices, in order

1. Deck list and create.
2. Generate cards from pasted text (structured array output).
3. Study screen with grading, scheduling the next review with date math.
4. Study fully offline; progress syncs on reconnect.
5. Web dashboard of deck statistics and review history.

### AI calls

- **Structured array output:** source text plus a card count → `[{front, back}]`.

---

## Fieldnote — site inspections

**One sentence:** Walk a site with a checklist, photograph problems, and get a written report — with a signature, from a basement with no signal.

**Why it fits:** exercises the form-heavy part of the component library including the signature field, and has the most legitimate offline requirement of any concept here. More B2B in feel, which makes for a less broadly relatable blog post.

### Models

| Model | Fields | Notes |
|-------|--------|-------|
| `ChecklistTemplate` | `name`, `items` (array of `{label, category}`) | Admin-curated |
| `Inspection` | `siteName`, `templateId` (ref), `status` (enum), `startedAt`, `completedAt`, `signatureUrl`, `ownerId` | |
| `Finding` | `inspectionId` (ref), `itemLabel`, `severity` (enum), `photoUrl`, `notes`, `ownerId` | Offline-write target |

### Slices, in order

1. Template list, admin-curated.
2. Start an inspection from a template.
3. Record findings with photos, offline.
4. AI-generated summary report from the findings (structured output).
5. Sign off with the signature field.
6. Web review screen with a findings table.
7. Admin template management.

### AI calls

- **Structured output:** findings array → `{summary, prioritizedActions, riskLevel}`.

---

## Trailmark — hike journal

**One sentence:** Log hikes, photograph what you see, and find out what it was — offline, above the tree line.

**Why it fits:** the most natural offline story of all five (there is no signal on a mountain) and a good AI vision use. Weaker admin story and it overlaps heavily with Sprout's shape, so prefer Sprout unless the outdoor framing matters for the post.

### Models

| Model | Fields |
|-------|--------|
| `Hike` | `name`, `trailhead`, `startedAt`, `endedAt`, `distanceKm`, `ownerId` |
| `Sighting` | `hikeId` (ref), `photoUrl`, `identifiedAs`, `confidence`, `notes`, `ownerId` |

### Slices, in order

1. Hike list and create.
2. Add sightings with photos, offline.
3. AI identification from a photo (structured output).
4. Web journal view with a hike summary.
5. Sync verification after returning to signal.

### AI calls

- **Structured output:** photo → `{identifiedAs, category, confidence, funFact}`.

---

## Capability coverage

| Capability | Sprout | Pantry | Recall | Fieldnote | Trailmark |
|------------|--------|--------|--------|-----------|-----------|
| Owner-scoped CRUD | yes | yes | yes | yes | yes |
| Shared/multi-user scope | optional | **core** | no | no | no |
| Admin-curated model | yes | yes | no | yes | no |
| AI structured object | yes | yes | no | yes | yes |
| AI structured array | no | yes | yes | no | no |
| AI streaming chat | yes | no | no | no | no |
| File upload | yes | yes | no | yes | yes |
| Offline writes | yes | yes | yes | yes | yes |
| Conflict resolution | no | **yes** | no | no | no |
| Realtime multi-client | yes | yes | no | no | no |
| Feature flag | yes | yes | yes | yes | yes |
| Signature field | no | no | no | **yes** | no |
| Web-specific dashboard | yes | yes | yes | yes | yes |
| Date math | yes | yes | **yes** | no | yes |

Sprout covers the most capabilities without needing a shared-scope model. Pantry is the only one that demonstrates conflict resolution, which is the hardest thing a local-first data layer does and therefore the most interesting to write about.
