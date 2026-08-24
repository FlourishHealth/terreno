/**
 * Creates and re-syncs the "Terreno Roadmap" GitHub Project from data that
 * already lives in the repository:
 *
 * - `.github/roadmap-fields.yml`  → Status / Target / Impact option lists
 * - `.github/labels.yml`          → Area option list (from `area:*` labels)
 * - `docs/explanation/roadmap-seed-issues.md` → one board item per roadmap entry
 *
 * The board is the source of truth for *state* (a maintainer dragging a card is
 * never overwritten by this script beyond the field values the repo declares),
 * and `bun run roadmap:generate` renders it back into `ROADMAP.md`. This script
 * closes the other half of the loop: it makes the board match the repo's
 * taxonomy and item list.
 *
 * Usage:
 *   bun run roadmap:sync --dry-run    # print the plan, mutate nothing
 *   bun run roadmap:sync --check      # exit 1 if the board has drifted (CI)
 *   bun run roadmap:sync              # apply
 *   bun run roadmap:sync --create-missing-issues   # also open absent tracking issues
 *
 * Requires a token with `project` scope: `gh auth refresh -s project`.
 */
import {parseArgs} from "node:util";

import {
  FIELDS_PATH,
  LABELS_PATH,
  type RoadmapFieldOptions,
  parseFieldOptions,
  parseLabelNames,
  validateRoadmapItem,
} from "./checkRoadmapItem.ts";
import {type SeedIssue, readSeedIssues} from "./seedIssues.ts";

export const PROJECT_TITLE = "Terreno Roadmap";
export const IP_FIELD_NAME = "IP";
export const COMMUNITY_FIELD_NAME = "Community interest";

/** GitHub requires a color and description on every single-select option. */
const OPTION_COLORS = ["BLUE", "GREEN", "YELLOW", "ORANGE", "RED", "PURPLE", "PINK", "GRAY"] as const;

export interface DesiredField {
  dataType: "SINGLE_SELECT" | "TEXT" | "NUMBER";
  name: string;
  options: string[];
}

export interface ExistingField {
  dataType: string;
  id: string;
  name: string;
  options: {id: string; name: string}[];
}

export interface FieldPlan {
  /** Fields that must be created from scratch. */
  create: DesiredField[];
  /** Existing fields whose option list must be rewritten to gain missing values. */
  rewriteOptions: {desired: string[]; field: ExistingField; missing: string[]}[];
  /** Problems a maintainer must resolve by hand (wrong data type on an existing field). */
  conflicts: string[];
}

export interface ResolvedItem {
  area: string;
  body: string | null;
  impact: string;
  ip: string;
  issueNumber: number | null;
  labels: string[];
  slug: string;
  status: string;
  target: string;
  title: string;
}

export interface ResolutionResult {
  items: ResolvedItem[];
  /** Entries deliberately left off the board, with the reason. */
  skipped: {reason: string; slug: string}[];
}

export const buildDesiredFields = ({options}: {options: RoadmapFieldOptions}): DesiredField[] => {
  return [
    {dataType: "SINGLE_SELECT", name: "Status", options: options.status},
    {dataType: "SINGLE_SELECT", name: "Area", options: options.areas},
    {dataType: "SINGLE_SELECT", name: "Target", options: options.target},
    {dataType: "SINGLE_SELECT", name: "Impact", options: options.impact},
    {dataType: "TEXT", name: IP_FIELD_NAME, options: []},
    {dataType: "NUMBER", name: COMMUNITY_FIELD_NAME, options: []},
  ];
};

/**
 * Compares the declared field set against the board. Missing options are added
 * by rewriting the whole option list (GitHub has no add-one-option mutation),
 * so the rewrite always carries the existing names through unchanged.
 */
export const planFields = ({
  desired,
  existing,
}: {
  desired: DesiredField[];
  existing: ExistingField[];
}): FieldPlan => {
  const plan: FieldPlan = {conflicts: [], create: [], rewriteOptions: []};
  const byName = new Map(existing.map((field) => [field.name, field]));

  for (const field of desired) {
    const match = byName.get(field.name);
    if (match === undefined) {
      plan.create.push(field);
      continue;
    }

    if (match.dataType !== field.dataType) {
      plan.conflicts.push(
        `Field "${field.name}" is ${match.dataType} on the board but ${field.dataType} in ${FIELDS_PATH}; fix it in the Project UI`
      );
      continue;
    }

    if (field.dataType !== "SINGLE_SELECT") {
      continue;
    }

    const present = new Set(match.options.map((option) => option.name));
    const missing = field.options.filter((option) => !present.has(option));
    if (missing.length === 0) {
      continue;
    }

    // Keep every existing option so no card loses its current value, then
    // append what the repo declares but the board lacks.
    const existingNames = match.options.map((option) => option.name);
    plan.rewriteOptions.push({
      desired: [...existingNames, ...missing],
      field: match,
      missing,
    });
  }

  return plan;
};

/**
 * Collapses the seed document's two shapes into one item per IP slug. A `##`
 * section supplies title, body, labels, and field values; the backfill table
 * supplies the issue number for slugs whose issue already exists.
 */
export const resolveSeedItems = ({
  issueNumbersByTitle,
  seeds,
}: {
  issueNumbersByTitle: Map<string, number>;
  seeds: SeedIssue[];
}): ResolutionResult => {
  const groups = new Map<string, SeedIssue[]>();
  for (const seed of seeds) {
    const key = seed.ip !== "" ? seed.ip : seed.slug;
    groups.set(key, [...(groups.get(key) ?? []), seed]);
  }

  const items: ResolvedItem[] = [];
  const skipped: {reason: string; slug: string}[] = [];

  for (const [key, group] of groups) {
    const section = group.find((seed) => seed.body !== null);
    const tableRow = group.find((seed) => seed.issueNumber !== null);
    const primary = section ?? tableRow;
    if (primary === undefined) {
      continue;
    }

    const title = primary.title !== "" ? primary.title : (tableRow?.title ?? "");
    const issueNumber = tableRow?.issueNumber ?? issueNumbersByTitle.get(title) ?? null;

    if (issueNumber === null && primary.ip === "") {
      // The repo's own process opens a tracking issue only once an IP is
      // approved. Drafting one here would put speculative work on a public board.
      skipped.push({reason: "no IP written yet — no tracking issue", slug: key});
      continue;
    }

    items.push({
      area: primary.area,
      body: section?.body ?? null,
      impact: primary.impact,
      ip: primary.ip,
      issueNumber,
      labels: primary.labels,
      slug: key,
      status: primary.status,
      target: primary.target,
      title,
    });
  }

  return {items, skipped};
};

export const validateItems = ({
  items,
  knownLabels,
  options,
}: {
  items: ResolvedItem[];
  knownLabels: string[];
  options: RoadmapFieldOptions;
}): string[] => {
  const problems: string[] = [];

  for (const item of items) {
    const itemProblems = validateRoadmapItem({
      item: {
        area: item.area,
        impact: item.impact,
        labels: item.labels,
        status: item.status,
        target: item.target,
      },
      knownLabels,
      options,
    });
    for (const problem of itemProblems) {
      problems.push(`${item.slug}: ${problem}`);
    }
  }

  return problems;
};

// ---------------------------------------------------------------------------
// GitHub API
// ---------------------------------------------------------------------------

const graphql = async <T>({
  query,
  token,
  variables,
}: {
  query: string;
  token: string;
  variables: Record<string, unknown>;
}): Promise<T> => {
  const response = await fetch("https://api.github.com/graphql", {
    body: JSON.stringify({query, variables}),
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "terreno-roadmap-sync",
    },
    method: "POST",
  });

  const payload = (await response.json()) as {data?: T; errors?: {message: string}[]};
  if (payload.errors !== undefined && payload.errors.length > 0) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }
  if (!response.ok || payload.data === undefined) {
    throw new Error(`GitHub GraphQL request failed with ${response.status}`);
  }

  return payload.data;
};

const PROJECTS_QUERY = `
query($owner: String!, $after: String) {
  organization(login: $owner) {
    id
    projectsV2(first: 50, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { id number title url }
    }
  }
}`;

const FIELDS_QUERY = `
query($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      fields(first: 50) {
        nodes {
          ... on ProjectV2FieldCommon { id name dataType }
          ... on ProjectV2SingleSelectField { id name dataType options { id name } }
        }
      }
    }
  }
}`;

const ITEMS_QUERY = `
query($projectId: ID!, $after: String) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          content { ... on Issue { number } }
          fieldValues(first: 20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
              ... on ProjectV2ItemFieldTextValue {
                text
                field { ... on ProjectV2FieldCommon { name } }
              }
            }
          }
        }
      }
    }
  }
}`;

const ISSUES_QUERY = `
query($owner: String!, $repo: String!, $after: String) {
  repository(owner: $owner, name: $repo) {
    id
    issues(first: 100, after: $after, states: [OPEN, CLOSED]) {
      pageInfo { hasNextPage endCursor }
      nodes { id number title labels(first: 30) { nodes { name } } }
    }
  }
}`;

interface RemoteIssue {
  id: string;
  labels: string[];
  number: number;
  title: string;
}

interface BoardItem {
  fields: Record<string, string>;
  id: string;
  issueNumber: number | null;
}

const optionInputs = (names: string[]): {color: string; description: string; name: string}[] => {
  return names.map((name, index) => ({
    color: OPTION_COLORS[index % OPTION_COLORS.length] ?? "GRAY",
    description: "",
    name,
  }));
};

const fetchIssues = async ({
  owner,
  repo,
  token,
}: {
  owner: string;
  repo: string;
  token: string;
}): Promise<{issues: RemoteIssue[]; repositoryId: string}> => {
  const issues: RemoteIssue[] = [];
  let after: string | null = null;
  let repositoryId = "";

  for (;;) {
    const data = await graphql<{
      repository: {
        id: string;
        issues: {
          nodes: {id: string; labels: {nodes: {name: string}[]}; number: number; title: string}[];
          pageInfo: {endCursor: string; hasNextPage: boolean};
        };
      };
    }>({query: ISSUES_QUERY, token, variables: {after, owner, repo}});

    repositoryId = data.repository.id;
    for (const node of data.repository.issues.nodes) {
      issues.push({
        id: node.id,
        labels: node.labels.nodes.map((label) => label.name),
        number: node.number,
        title: node.title,
      });
    }

    if (!data.repository.issues.pageInfo.hasNextPage) {
      break;
    }
    after = data.repository.issues.pageInfo.endCursor;
  }

  return {issues, repositoryId};
};

const fetchBoardItems = async ({
  projectId,
  token,
}: {
  projectId: string;
  token: string;
}): Promise<BoardItem[]> => {
  const items: BoardItem[] = [];
  let after: string | null = null;

  for (;;) {
    const data = await graphql<{
      node: {
        items: {
          nodes: {
            content: {number?: number} | null;
            fieldValues: {nodes: {field?: {name?: string}; name?: string; text?: string}[]};
            id: string;
          }[];
          pageInfo: {endCursor: string; hasNextPage: boolean};
        };
      };
    }>({query: ITEMS_QUERY, token, variables: {after, projectId}});

    for (const node of data.node.items.nodes) {
      const fields: Record<string, string> = {};
      for (const value of node.fieldValues.nodes) {
        const name = value.field?.name;
        if (name === undefined || name === "") {
          continue;
        }
        fields[name] = value.name ?? value.text ?? "";
      }
      items.push({fields, id: node.id, issueNumber: node.content?.number ?? null});
    }

    if (!data.node.items.pageInfo.hasNextPage) {
      break;
    }
    after = data.node.items.pageInfo.endCursor;
  }

  return items;
};

const fetchFields = async ({
  projectId,
  token,
}: {
  projectId: string;
  token: string;
}): Promise<ExistingField[]> => {
  const data = await graphql<{
    node: {fields: {nodes: {dataType: string; id: string; name: string; options?: {id: string; name: string}[]}[]}};
  }>({query: FIELDS_QUERY, token, variables: {projectId}});

  return data.node.fields.nodes.map((field) => ({
    dataType: field.dataType,
    id: field.id,
    name: field.name,
    options: field.options ?? [],
  }));
};

export const main = async (): Promise<void> => {
  const {values} = parseArgs({
    options: {
      check: {default: false, type: "boolean"},
      "create-missing-issues": {default: false, type: "boolean"},
      "dry-run": {default: false, type: "boolean"},
      owner: {default: "FlourishHealth", type: "string"},
      repo: {default: "terreno", type: "string"},
    },
    strict: true,
  });

  const token = process.env.GITHUB_TOKEN?.trim() ?? "";
  if (token === "") {
    console.error("roadmap:sync requires GITHUB_TOKEN. Try: GITHUB_TOKEN=$(gh auth token) bun run roadmap:sync");
    console.error("The token needs the `project` scope: gh auth refresh -s project");
    process.exit(1);
  }

  const readOnly = values.check || values["dry-run"];
  const knownLabels = parseLabelNames(await Bun.file(LABELS_PATH).text());
  const options = parseFieldOptions({
    fieldsContents: await Bun.file(FIELDS_PATH).text(),
    labelNames: knownLabels,
  });

  const seeds = await readSeedIssues();
  const {issues, repositoryId} = await fetchIssues({owner: values.owner, repo: values.repo, token});
  const issueNumbersByTitle = new Map(issues.map((issue) => [issue.title, issue.number]));
  const {items, skipped} = resolveSeedItems({issueNumbersByTitle, seeds});

  const problems = validateItems({items, knownLabels, options});
  if (problems.length > 0) {
    console.error(`roadmap:sync found ${problems.length} invalid seed entries:`);
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }

  const actions: string[] = [];
  const issuesById = new Map(issues.map((issue) => [issue.number, issue]));

  // --- labels on issues -----------------------------------------------------
  const missingRepoLabels = [...new Set(items.flatMap((item) => item.labels))].filter(
    (label) => !knownLabels.includes(label)
  );
  if (missingRepoLabels.length > 0) {
    console.error(`Labels not defined in ${LABELS_PATH}: ${missingRepoLabels.join(", ")}`);
    process.exit(1);
  }

  const labelWork: {labels: string[]; number: number}[] = [];
  for (const item of items) {
    if (item.issueNumber === null) {
      continue;
    }
    const issue = issuesById.get(item.issueNumber);
    if (issue === undefined) {
      continue;
    }
    const toAdd = item.labels.filter((label) => !issue.labels.includes(label));
    if (toAdd.length > 0) {
      labelWork.push({labels: toAdd, number: item.issueNumber});
      actions.push(`label #${item.issueNumber} += ${toAdd.join(", ")}`);
    }
  }

  // Reported before the project queries so a dry run is still useful when the
  // token lacks project scope.
  console.info(`Seed entries: ${items.length} to place on the board, ${skipped.length} skipped`);
  for (const entry of skipped) {
    console.info(`  · skip ${entry.slug} — ${entry.reason}`);
  }
  console.info(`Issue labels to add: ${labelWork.length}`);

  // --- project --------------------------------------------------------------
  const projectsData = await graphql<{
    organization: {id: string; projectsV2: {nodes: {id: string; number: number; title: string; url: string}[]}};
  }>({query: PROJECTS_QUERY, token, variables: {after: null, owner: values.owner}}).catch(
    (error: unknown): never => {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("read:project")) {
        throw new Error(
          "The token cannot read Projects. Run `gh auth refresh -s project` (or use a PAT with read:project) and retry."
        );
      }
      throw error;
    }
  );

  let project = projectsData.organization.projectsV2.nodes.find((node) => node.title === PROJECT_TITLE);
  if (project === undefined) {
    actions.push(`create Project "${PROJECT_TITLE}" under ${values.owner}`);
    if (readOnly) {
      console.info(`Plan (${actions.length} actions):`);
      for (const action of actions) {
        console.info(`  - ${action}`);
      }
      console.info("\nThe project does not exist yet, so field and item planning cannot be resolved.");
      console.info("Re-run without --dry-run/--check to create it, then plan again.");
      process.exit(values.check ? 1 : 0);
    }

    const created = await graphql<{createProjectV2: {projectV2: {id: string; number: number; url: string}}}>({
      query: `mutation($ownerId: ID!, $repositoryId: ID!, $title: String!) {
        createProjectV2(input: {ownerId: $ownerId, repositoryId: $repositoryId, title: $title}) {
          projectV2 { id number url }
        }
      }`,
      token,
      variables: {ownerId: projectsData.organization.id, repositoryId, title: PROJECT_TITLE},
    });
    project = {...created.createProjectV2.projectV2, title: PROJECT_TITLE};
    console.info(`Created ${project.url} (number ${project.number})`);
  }

  const desiredFields = buildDesiredFields({options});
  const existingFields = await fetchFields({projectId: project.id, token});
  const fieldPlan = planFields({desired: desiredFields, existing: existingFields});

  if (fieldPlan.conflicts.length > 0) {
    for (const conflict of fieldPlan.conflicts) {
      console.error(`  ! ${conflict}`);
    }
    process.exit(1);
  }

  for (const field of fieldPlan.create) {
    actions.push(`create field "${field.name}" (${field.dataType})`);
  }
  for (const rewrite of fieldPlan.rewriteOptions) {
    actions.push(`field "${rewrite.field.name}" += options ${rewrite.missing.join(", ")}`);
  }

  // --- items ----------------------------------------------------------------
  const boardItems = await fetchBoardItems({projectId: project.id, token});
  const boardByIssue = new Map(
    boardItems.filter((item) => item.issueNumber !== null).map((item) => [item.issueNumber as number, item])
  );

  const fieldValuePlan: {field: string; itemIssue: number; value: string}[] = [];
  for (const item of items) {
    if (item.issueNumber === null) {
      actions.push(
        values["create-missing-issues"]
          ? `create issue "${item.title}"`
          : `SKIP "${item.title}" (no issue; pass --create-missing-issues to open one)`
      );
      continue;
    }

    const boardItem = boardByIssue.get(item.issueNumber);
    if (boardItem === undefined) {
      actions.push(`add #${item.issueNumber} to the board`);
    }

    const wanted: Record<string, string> = {
      Area: item.area,
      Impact: item.impact,
      [IP_FIELD_NAME]: item.ip,
      Status: item.status,
      Target: item.target,
    };
    for (const [field, value] of Object.entries(wanted)) {
      if (value === "" && field !== IP_FIELD_NAME) {
        continue;
      }
      if (boardItem?.fields[field] === value) {
        continue;
      }
      fieldValuePlan.push({field, itemIssue: item.issueNumber, value});
      actions.push(`#${item.issueNumber} ${field} = ${value === "" ? "(empty)" : value}`);
    }
  }

  console.info(`Board: ${project.url}`);

  if (actions.length === 0) {
    console.info("\nBoard is in sync with the repository.");
    return;
  }

  console.info(`\nPlan (${actions.length} actions):`);
  for (const action of actions) {
    console.info(`  - ${action}`);
  }

  if (values.check) {
    console.error(`\nroadmap:sync --check: board has drifted (${actions.length} pending actions)`);
    process.exit(1);
  }
  if (values["dry-run"]) {
    console.info("\n--dry-run: nothing was changed.");
    return;
  }

  // --- apply ----------------------------------------------------------------
  for (const work of labelWork) {
    const result = Bun.spawnSync([
      "gh",
      "issue",
      "edit",
      String(work.number),
      "--repo",
      `${values.owner}/${values.repo}`,
      ...work.labels.flatMap((label) => ["--add-label", label]),
    ]);
    if (result.exitCode !== 0) {
      throw new Error(`gh issue edit #${work.number} failed: ${result.stderr.toString()}`);
    }
    console.info(`Labelled #${work.number}`);
  }

  for (const field of fieldPlan.create) {
    await graphql({
      query: `mutation($projectId: ID!, $name: String!, $dataType: ProjectV2CustomFieldType!, $options: [ProjectV2SingleSelectFieldOptionInput!]) {
        createProjectV2Field(input: {projectId: $projectId, name: $name, dataType: $dataType, singleSelectOptions: $options}) {
          projectV2Field { ... on ProjectV2FieldCommon { id name } }
        }
      }`,
      token,
      variables: {
        dataType: field.dataType,
        name: field.name,
        options: field.dataType === "SINGLE_SELECT" ? optionInputs(field.options) : [],
        projectId: project.id,
      },
    });
    console.info(`Created field ${field.name}`);
  }

  for (const rewrite of fieldPlan.rewriteOptions) {
    await graphql({
      query: `mutation($fieldId: ID!, $options: [ProjectV2SingleSelectFieldOptionInput!]) {
        updateProjectV2Field(input: {fieldId: $fieldId, singleSelectOptions: $options}) {
          projectV2Field { ... on ProjectV2SingleSelectField { id } }
        }
      }`,
      token,
      variables: {fieldId: rewrite.field.id, options: optionInputs(rewrite.desired)},
    });
    console.info(`Updated options on ${rewrite.field.name}`);
  }

  // Field ids change once fields are created, so re-read before setting values.
  const finalFields = await fetchFields({projectId: project.id, token});
  const fieldsByName = new Map(finalFields.map((field) => [field.name, field]));

  const itemIdByIssue = new Map<number, string>(
    [...boardByIssue.entries()].map(([number, item]) => [number, item.id])
  );

  if (values["create-missing-issues"]) {
    for (const item of items) {
      if (item.issueNumber !== null || item.body === null) {
        continue;
      }
      const created = Bun.spawnSync([
        "gh",
        "issue",
        "create",
        "--repo",
        `${values.owner}/${values.repo}`,
        "--title",
        item.title,
        "--body",
        item.body,
        ...item.labels.flatMap((label) => ["--label", label]),
      ]);
      if (created.exitCode !== 0) {
        throw new Error(`gh issue create "${item.title}" failed: ${created.stderr.toString()}`);
      }

      const url = created.stdout.toString().trim();
      const number = Number.parseInt(url.split("/").pop() ?? "", 10);
      if (Number.isNaN(number)) {
        throw new Error(`Could not read an issue number out of "${url}"`);
      }
      item.issueNumber = number;
      const node = await graphql<{repository: {issue: {id: string}}}>({
        query: `query($owner: String!, $repo: String!, $number: Int!) {
          repository(owner: $owner, name: $repo) { issue(number: $number) { id } }
        }`,
        token,
        variables: {number, owner: values.owner, repo: values.repo},
      });
      issuesById.set(number, {id: node.repository.issue.id, labels: item.labels, number, title: item.title});
      for (const [field, value] of Object.entries({
        Area: item.area,
        Impact: item.impact,
        [IP_FIELD_NAME]: item.ip,
        Status: item.status,
        Target: item.target,
      })) {
        fieldValuePlan.push({field, itemIssue: number, value});
      }
      console.info(`Created ${url}`);
    }
  }

  for (const item of items) {
    if (item.issueNumber === null || itemIdByIssue.has(item.issueNumber)) {
      continue;
    }
    const issue = issuesById.get(item.issueNumber);
    if (issue === undefined) {
      console.warn(`Issue #${item.issueNumber} not found in ${values.owner}/${values.repo}; skipping`);
      continue;
    }
    const added = await graphql<{addProjectV2ItemById: {item: {id: string}}}>({
      query: `mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) { item { id } }
      }`,
      token,
      variables: {contentId: issue.id, projectId: project.id},
    });
    itemIdByIssue.set(item.issueNumber, added.addProjectV2ItemById.item.id);
    console.info(`Added #${item.issueNumber}`);
  }

  for (const entry of fieldValuePlan) {
    const field = fieldsByName.get(entry.field);
    const itemId = itemIdByIssue.get(entry.itemIssue);
    if (field === undefined || itemId === undefined) {
      continue;
    }

    let value: Record<string, unknown>;
    if (field.dataType === "SINGLE_SELECT") {
      const option = field.options.find((candidate) => candidate.name === entry.value);
      if (option === undefined) {
        console.warn(`Option "${entry.value}" missing on field ${field.name}; skipping #${entry.itemIssue}`);
        continue;
      }
      value = {singleSelectOptionId: option.id};
    } else {
      value = {text: entry.value};
    }

    await graphql({
      query: `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(input: {projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value}) {
          projectV2Item { id }
        }
      }`,
      token,
      variables: {fieldId: field.id, itemId, projectId: project.id, value},
    });
  }

  console.info(`\nApplied ${actions.length} actions. Set TERRENO_PROJECT_NUMBER=${project.number}`);
};

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
