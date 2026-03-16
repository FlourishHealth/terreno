/**
 * Sync consent form definitions from code to the database.
 *
 * Compares the provided definitions (keyed by slug) against what's in the database
 * and creates, updates, or deactivates forms to match. When content changes, a new
 * version is published so users are prompted to re-consent.
 */

import {logger} from "./logger";
import {ConsentForm} from "./models/consentForm";
import type {ConsentFormType} from "./types/consentForm";

export interface ConsentFormDefinition {
  title: string;
  type: ConsentFormType;
  content: Record<string, string>;
  order?: number;
  required?: boolean;
  requireScrollToBottom?: boolean;
  captureSignature?: boolean;
  agreeButtonText?: string;
  allowDecline?: boolean;
  declineButtonText?: string;
  defaultLocale?: string;
  checkboxes?: Array<{
    label: string;
    required?: boolean;
    confirmationPrompt?: string;
  }>;
}

export interface SyncConsentsOptions {
  /** Deactivate database forms whose slugs are not in the definitions. Default: false */
  deactivateRemoved?: boolean;
  /** If true, log what would change without writing to the database. Default: false */
  dryRun?: boolean;
}

export interface SyncConsentsResult {
  created: string[];
  updated: string[];
  deactivated: string[];
  unchanged: string[];
}

const contentEqual = (a: Map<string, string>, b: Record<string, string>): boolean => {
  const aKeys = [...a.keys()].sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((key, i) => key === bKeys[i] && a.get(key) === b[key]);
};

const formFieldsMatch = (
  existing: {
    title: string;
    type: string;
    order: number;
    required: boolean;
    requireScrollToBottom: boolean;
    captureSignature: boolean;
    agreeButtonText: string;
    allowDecline: boolean;
    declineButtonText: string;
    defaultLocale: string;
    checkboxes: Array<{label: string; required: boolean; confirmationPrompt?: string}>;
    content: Map<string, string>;
  },
  def: ConsentFormDefinition
): boolean => {
  if (existing.title !== def.title) {
    return false;
  }
  if (existing.type !== def.type) {
    return false;
  }
  if (existing.order !== (def.order ?? 0)) {
    return false;
  }
  if (existing.required !== (def.required ?? true)) {
    return false;
  }
  if (existing.requireScrollToBottom !== (def.requireScrollToBottom ?? false)) {
    return false;
  }
  if (existing.captureSignature !== (def.captureSignature ?? false)) {
    return false;
  }
  if (existing.agreeButtonText !== (def.agreeButtonText ?? "I Agree")) {
    return false;
  }
  if (existing.allowDecline !== (def.allowDecline ?? false)) {
    return false;
  }
  if (existing.declineButtonText !== (def.declineButtonText ?? "Decline")) {
    return false;
  }
  if (existing.defaultLocale !== (def.defaultLocale ?? "en")) {
    return false;
  }
  if (!contentEqual(existing.content, def.content)) {
    return false;
  }

  const existingCheckboxes = existing.checkboxes ?? [];
  const defCheckboxes = def.checkboxes ?? [];
  if (existingCheckboxes.length !== defCheckboxes.length) {
    return false;
  }
  for (let i = 0; i < existingCheckboxes.length; i++) {
    const ec = existingCheckboxes[i];
    const dc = defCheckboxes[i];
    if (ec.label !== dc.label || ec.required !== (dc.required ?? false)) {
      return false;
    }
    if ((ec.confirmationPrompt ?? undefined) !== (dc.confirmationPrompt ?? undefined)) {
      return false;
    }
  }

  return true;
};

/**
 * Sync consent form definitions to the database.
 *
 * @param definitions - Map of slug to consent form definition
 * @param options - Sync options
 * @returns Summary of what was created, updated, deactivated, or unchanged
 *
 * @example
 * ```typescript
 * import {syncConsents} from "@terreno/api";
 *
 * await syncConsents({
 *   "terms-of-service": {
 *     title: "Terms of Service",
 *     type: "terms",
 *     content: {"en": "# Terms\n...", "es": "# Términos\n..."},
 *     required: true,
 *     order: 1,
 *   },
 *   "privacy-policy": {
 *     title: "Privacy Policy",
 *     type: "privacy",
 *     content: {"en": "# Privacy\n..."},
 *     order: 2,
 *   },
 * });
 * ```
 */
export const syncConsents = async (
  definitions: Record<string, ConsentFormDefinition>,
  options: SyncConsentsOptions = {}
): Promise<SyncConsentsResult> => {
  const {deactivateRemoved = false, dryRun = false} = options;

  const result: SyncConsentsResult = {
    created: [],
    deactivated: [],
    unchanged: [],
    updated: [],
  };

  const slugs = Object.keys(definitions);

  // Fetch the current active form for each slug
  const activeForms = await ConsentForm.find({active: true});
  const activeBySlug = new Map(activeForms.map((f) => [f.slug, f]));

  for (const slug of slugs) {
    const def = definitions[slug];
    const existing = activeBySlug.get(slug);

    if (!existing) {
      // No active form for this slug — create version 1
      logger.info(`syncConsents: creating "${slug}"`, {dryRun});
      if (!dryRun) {
        await ConsentForm.create({
          active: true,
          agreeButtonText: def.agreeButtonText,
          allowDecline: def.allowDecline,
          captureSignature: def.captureSignature,
          checkboxes: def.checkboxes,
          content: new Map(Object.entries(def.content)),
          declineButtonText: def.declineButtonText,
          defaultLocale: def.defaultLocale,
          order: def.order ?? 0,
          required: def.required ?? true,
          requireScrollToBottom: def.requireScrollToBottom,
          slug,
          title: def.title,
          type: def.type,
          version: 1,
        });
      }
      result.created.push(slug);
      continue;
    }

    if (formFieldsMatch(existing, def)) {
      result.unchanged.push(slug);
      continue;
    }

    // Content or config changed — publish a new version
    const newVersion = existing.version + 1;
    logger.info(`syncConsents: updating "${slug}" v${existing.version} -> v${newVersion}`, {dryRun});
    if (!dryRun) {
      await ConsentForm.create({
        active: true,
        agreeButtonText: def.agreeButtonText,
        allowDecline: def.allowDecline,
        captureSignature: def.captureSignature,
        checkboxes: def.checkboxes,
        content: new Map(Object.entries(def.content)),
        declineButtonText: def.declineButtonText,
        defaultLocale: def.defaultLocale,
        order: def.order ?? 0,
        required: def.required ?? true,
        requireScrollToBottom: def.requireScrollToBottom,
        slug,
        title: def.title,
        type: def.type,
        version: newVersion,
      });
      await ConsentForm.updateMany({_id: {$ne: undefined}, slug, version: {$lt: newVersion}}, {active: false});
    }
    result.updated.push(slug);
  }

  // Deactivate forms that are no longer in definitions
  if (deactivateRemoved) {
    for (const [slug, form] of activeBySlug) {
      if (!definitions[slug]) {
        logger.info(`syncConsents: deactivating "${slug}"`, {dryRun});
        if (!dryRun) {
          await ConsentForm.updateMany({slug}, {active: false});
        }
        result.deactivated.push(slug);
      }
    }
  }

  const summary = [
    result.created.length > 0 ? `created: ${result.created.join(", ")}` : null,
    result.updated.length > 0 ? `updated: ${result.updated.join(", ")}` : null,
    result.deactivated.length > 0 ? `deactivated: ${result.deactivated.join(", ")}` : null,
    result.unchanged.length > 0 ? `unchanged: ${result.unchanged.join(", ")}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  logger.info(`syncConsents: ${dryRun ? "[DRY RUN] " : ""}${summary || "nothing to do"}`);

  return result;
};
