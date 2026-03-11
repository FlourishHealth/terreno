# Implementation Plans

Forward-looking implementation plans for significant features and architectural changes to Terreno packages.

## Purpose

This directory contains detailed technical plans for major features **before implementation**. Each plan documents:

- Design goals and rationale
- Architecture and file structure
- Configuration interfaces
- Usage examples
- Breaking changes and migration paths
- Implementation tasks and phases

## Current Plans

- **[Modular API (TerrenoApp)](ModularAPI.md)** — New fluent builder API to replace `setupServer` in `@terreno/api`

## Status Tracking

| Plan | Status | Target Version | Discussion |
|------|--------|----------------|------------|
| Modular API | 📝 Planning | 2.0.0 | [#149](https://github.com/FlourishHealth/terreno/pull/149) |

## Process

1. **Planning**: Implementation plan merged to master
2. **Discussion**: Community feedback in linked PR/issue
3. **Implementation**: Feature developed in feature branch with tests
4. **Documentation**: How-to guides and migration docs updated
5. **Release**: Plan moves to `docs/explanation/` as architectural documentation

Plans that are fully implemented should be moved to `docs/explanation/` and updated to reflect the actual implementation.
