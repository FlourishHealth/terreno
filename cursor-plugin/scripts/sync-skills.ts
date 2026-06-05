#!/usr/bin/env bun
/**
 * Sync cursor-plugin/skills/ → .rulesync/skills/
 * Source of truth: cursor-plugin/skills/
 */

import {cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync} from "node:fs";
import {join, resolve} from "node:path";

const REPO_ROOT = resolve(import.meta.dir, "../..");
const SOURCE_DIR = join(REPO_ROOT, "cursor-plugin/skills");
const TARGET_DIR = join(REPO_ROOT, ".rulesync/skills");

const REMOVED_SKILLS = ["submit", "implement"];

const syncSkills = (): void => {
  if (!existsSync(SOURCE_DIR)) {
    console.error(`Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  mkdirSync(TARGET_DIR, {recursive: true});

  const skillDirs = readdirSync(SOURCE_DIR).filter((entry) => {
    const fullPath = join(SOURCE_DIR, entry);
    return statSync(fullPath).isDirectory();
  });

  for (const skillDir of skillDirs) {
    const sourcePath = join(SOURCE_DIR, skillDir);
    const targetPath = join(TARGET_DIR, skillDir);
    cpSync(sourcePath, targetPath, {recursive: true, force: true});
    console.info(`Synced: ${skillDir}`);
  }

  for (const removed of REMOVED_SKILLS) {
    const targetPath = join(TARGET_DIR, removed);
    if (existsSync(targetPath)) {
      rmSync(targetPath, {recursive: true, force: true});
      console.info(`Removed legacy skill: ${removed}`);
    }
  }

  console.info(`\nSynced ${skillDirs.length} skills to ${TARGET_DIR}`);
};

syncSkills();
