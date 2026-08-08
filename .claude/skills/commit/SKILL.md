---
name: commit
description: >-
  Create a commit for the current staged/unstaged changes with a clear, accurate
  message
model: haiku
disable-model-invocation: true
---
# Commit Changes

Create a commit for the current staged/unstaged changes.

## Instructions

1. Check git status and diff to understand what changed:
   ```
   git status
   git diff
   git diff --cached
   ```


2. Stage changes appropriately and create a commit:
   - Review the actual changes to write an accurate commit message

   **Message Format:**
   - The first line must be under 72 characters
   - Add a body if more context is needed
   - Exclude conventional commit prefixes (feat:, fix:, chore:, etc.)

   **Content Restrictions:**
   - Exclude any mention of AI, Claude, or any AI assistant
   - Exclude making the commit coauthored by any AI
   - Exclude adding "Co-Authored-By" trailers

   *If constraints conflict, prioritize Message Format for clarity and readability.*

3. Never push unless explicitly asked.

## Arguments

$DESCRIPTION: Optional description to guide the commit message
