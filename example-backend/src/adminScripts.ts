import type {AdminScriptConfig} from "@terreno/admin-backend";
import {syncConsents} from "@terreno/api";

import {consentDefinitions} from "./consentDefinitions";
import {Todo} from "./models/todo";
import {User} from "./models/user";
import {seedFeatureFlags} from "./scripts/seed-feature-flags";

/**
 * Scripts registered on the admin panel. Exported separately from the server so the
 * same definitions can be exposed both via the admin HTTP routes (AdminApp) and as a
 * project CLI (`bun run script <name>`). Argument handling is identical in both.
 */
export const adminScripts: AdminScriptConfig[] = [
  {
    args: [
      {
        default: "all",
        description: "Which collection to count: todos, users, or all",
        example: "todos",
        name: "model",
        type: "string",
      },
    ],
    description: "Count all todos and users in the database",
    name: "countRecords",
    runner: async (wetRun, ctx) => {
      const model = ctx?.args.getString("model", "all") ?? "all";
      const results: string[] = [];

      if (model === "todos" || model === "all") {
        const todoCount = await Todo.countDocuments();
        results.push(`Found ${todoCount} todos`);
      }
      if (model === "users" || model === "all") {
        const userCount = await User.countDocuments();
        results.push(`Found ${userCount} users`);
      }
      if (results.length === 0) {
        results.push(`Unknown model "${model}". Use one of: todos, users, all`);
        return {results, success: false};
      }

      if (wetRun) {
        results.push("Wet run: no additional changes made by this script");
      } else {
        results.push("Dry run: no changes made");
      }
      return {results, success: true};
    },
  },
  {
    description:
      "Sync consent forms (Terms of Service, Privacy Policy) from code definitions to the database",
    name: "syncConsents",
    runner: async (wetRun) => {
      const result = await syncConsents(consentDefinitions, {
        deactivateRemoved: true,
        dryRun: !wetRun,
      });
      const results: string[] = [];
      if (result.created.length > 0) {
        results.push(`Created: ${result.created.join(", ")}`);
      }
      if (result.updated.length > 0) {
        results.push(`Updated: ${result.updated.join(", ")}`);
      }
      if (result.deactivated.length > 0) {
        results.push(`Deactivated: ${result.deactivated.join(", ")}`);
      }
      if (result.unchanged.length > 0) {
        results.push(`Unchanged: ${result.unchanged.join(", ")}`);
      }
      if (results.length === 0) {
        results.push("Nothing to do");
      }
      return {results, success: true};
    },
  },
  {
    description:
      "Seed example feature flags (boolean and variant). Skips flags that already exist.",
    name: "seedFeatureFlags",
    runner: async (wetRun) => {
      if (!wetRun) {
        return {
          results: [
            "Dry run: would create up to 5 example feature flags",
            "Run as wet run to actually create them",
          ],
          success: true,
        };
      }
      return seedFeatureFlags();
    },
  },
];
