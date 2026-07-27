# Blog post outline

Structure for the `BLOG_DRAFT.md` produced by [`build-terreno-app`](../SKILL.md).

## What this post is

A build-in-public account of an AI agent building and shipping a real universal app on Terreno, with the friction included. The value proposition to the reader is not "look how easy this is" — every framework's launch post claims that and nobody believes it. The value is a specific, verifiable account of what happened, including what did not work.

Target length: 1,800–2,500 words. Long enough to be substantive, short enough to be read.

## Rules

- **Every claim is backed by an artifact.** If the post says the offline log survived a reload, there is a recording of the reload.
- **Include the friction.** Pick the three most instructive gaps from `FRICTION_LOG.md` and write them up honestly, each with what was fixed as a result. A post with no friction reads as marketing and gets discounted entirely.
- **No unquantified superlatives.** "Fast" means a number. "Simple" means a line count or a step count.
- **Show real code**, copied from the app that was actually built, not idealized.
- **Do not claim unshipped features.** Check anything uncertain against the public docs.
- **Name the timestamps.** Real elapsed time per phase is the most credible thing in the post.

## Structure

### 1. Hook (150 words)

The app, in one sentence, and what it does that is only possible because it is universal and AI-assisted. One screenshot: the same screen on a phone and in a browser.

### 2. Why this framing (200 words)

Terreno is Django/Rails for TypeScript with universal app support. Establish what that means concretely — batteries included, one codebase for three platforms, agents as a first-class client — and state what this post is testing: whether an agent with only public documentation can ship a real app.

Be explicit about the constraint that makes the experiment meaningful: no access to framework internals, no insider knowledge.

### 3. What got built (300 words)

The app's models and screens, with a schema code block and the model count. The point to land: how little application code there is relative to what the app does, with real numbers — lines of app code versus the features working.

### 4. The build, phase by phase (600 words)

Walk the slices with real elapsed times. Emphasize the moments where the framework did work the reader would otherwise do by hand:

- One model definition producing a full CRUD API with permissions, pagination, and filtering
- The OpenAPI spec producing a typed client with no hand-written API layer
- Registering a model producing a working admin panel
- The same screen code running on three platforms

One code block per claim, taken from the built app.

### 5. Where AI actually helped (400 words)

Two distinct things, and the post must separate them clearly because conflating them is confusing:

- **AI in the app** — the structured-output call and the streaming chat, with the prompt (as a constant) and the typed result.
- **AI building the app** — the agent loop: searched the docs, generated conventional code, ran the app, and then the part worth writing about: a deliberate bug found through `last_error` and `read_logs` rather than by reading source. Give the elapsed time from symptom to fix.

The narrow, defensible claim: the agent observed what the app actually did, not a description of it. Do not overreach past that.

### 6. The local-first part (300 words)

The offline demonstration, with a recording: network off, mutation, immediate UI update, page reload, the change still there, network on, synced. Then what it means for the code — the loading states and manual optimistic updates that were never written. If the run used the Pantry concept, the conflict-resolution demonstration goes here and is the most interesting content in the post.

### 7. Deploying it (250 words)

From code to a public URL, with the real step count and elapsed time. Include the thing that broke — deployment always breaks something — and how it was diagnosed.

### 8. What did not work (350 words)

The three most instructive gaps from the friction log. For each: what was expected, what happened, what it cost, and what was fixed as a result (with an issue or PR link).

This section is what makes the rest of the post believable. Do not soften it, and do not pick three trivial gaps to look honest while hiding a real one.

### 9. Try it (150 words)

Links: docs site, quickstart, MCP setup guide, the app's repository, and the Discussions category for questions. One command to start.

## Artifact checklist

Every item must exist in `/opt/cursor/artifacts/` before the draft is considered complete:

| Artifact | Shows |
|----------|-------|
| `same_screen_mobile_and_web.png` | The universal-app claim |
| `model_to_api.png` or a code block | One model producing a full CRUD API |
| `ai_structured_output.png` | The typed AI result in the UI |
| `ai_streaming_chat.mp4` | Streaming chat working |
| `offline_write_and_sync.mp4` | Network off → mutate → reload → restore → sync |
| `conflict_resolution.mp4` | Only for the Pantry concept |
| `realtime_two_clients.mp4` | A change in one client appearing in another |
| `admin_panel.png` | The admin panel with the curated model |
| `agent_found_the_bug.png` | Real `last_error` output locating the bug |
| `deployed_app.png` | The app on its public URL, logged in |

Recordings should be short — start immediately before the demonstrated behavior and stop immediately after. A three-minute recording with twenty seconds of content does not get watched.

## Publication

Per the program's open question on publication venue, the default is to publish on the docs site blog with canonical URL there, and syndicate elsewhere with a canonical link back. Confirm before publishing.

Before publishing, have someone who did not do the build read the draft and confirm that every claim is checkable from the artifacts.
