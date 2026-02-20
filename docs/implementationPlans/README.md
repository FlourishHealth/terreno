# Implementation Plans

This directory contains **design documents** for planned features that are **not yet implemented** in the Terreno monorepo. These documents outline future architectural changes, new APIs, and breaking changes before implementation begins.

## Purpose

Implementation plans serve multiple purposes:

1. **Design Documentation** - Detail the architecture, interfaces, and implementation approach before writing code
2. **Team Alignment** - Ensure everyone understands the planned changes and can provide feedback
3. **AI Assistant Context** - Help AI coding assistants understand planned future work to avoid suggesting outdated patterns

## Status

All documents in this directory describe **future features** unless explicitly marked as implemented. When a plan is fully implemented:

- Mark it as "✅ Implemented" in this README
- Update relevant package documentation to reflect the new APIs
- Consider moving detailed content to reference docs

## Current Plans

| Plan | Status | Description |
|------|--------|-------------|
| [ModularAPI.md](ModularAPI.md) | 🚧 Planned | New `TerrenoApp` class to replace `setupServer` in @terreno/api |

## Creating a New Implementation Plan

When adding a new implementation plan:

1. Create a markdown file with a descriptive name (e.g., `FeatureName.md`)
2. Include these sections:
   - **Overview** - What problem does this solve?
   - **Goals** - What are the key objectives?
   - **Architecture** - File structure, classes, interfaces
   - **Configuration** - Options, environment variables
   - **Implementation Tasks** - Phased breakdown of work
   - **Breaking Changes** - What will change for users?
   - **Migration Guide** - How do users upgrade?
3. Add an entry to the table above
4. Reference it in root-level documentation if it impacts overall architecture

## Using Implementation Plans

**For Developers:**
- Review plans before starting work on related features
- Update plans as the design evolves
- Mark plans as implemented when complete

**For AI Assistants:**
- Check plans before suggesting major refactors - the change may already be designed
- Use **current APIs** in code suggestions, not planned future APIs
- Reference plans when discussing architectural decisions or future work
