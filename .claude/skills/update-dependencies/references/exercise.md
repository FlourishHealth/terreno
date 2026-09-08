# Exercise tests

An update is unproven until a test that **imports the bumped package** passes
on the new version.

## Find

```bash
rg -l "from [\"']<package>" --glob '*.test.ts' --glob '*.test.tsx' --glob '*.spec.ts'
rg -l "from [\"']<package>" --glob '*.ts' --glob '*.tsx'
```

The exercise test is a test file that imports `<package>`. A suite that never
imports it does not count, even if it lives in the same workspace package.

## Write a tracer when none exists

Put the test next to the consumer (for example `api/src/<area>.<pkg>.test.ts`).
Import the real dependency. Assert one behavior this repo already relies on
(a function return, a plugin registering, a component rendering through
`renderWithTheme`). Do not mock the dependency under test.

Run that test on the current version, then bump, then run it again.

## Commands

Package-local, not the full monorepo, during the red/green cycle:

```bash
bun test --only-failures <exercise-test-path>
```

After green, lint/compile the consuming package. Product CI still runs on the PR.
