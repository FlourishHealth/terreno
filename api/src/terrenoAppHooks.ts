import {logger} from "./logger";
import type {AppHooks} from "./terrenoAppOptions";

export type HookName = keyof AppHooks;

export const runHook = async <K extends HookName>(
  hooks: AppHooks | undefined,
  name: K,
  ...args: Parameters<NonNullable<AppHooks[K]>>
): Promise<void> => {
  const hook = hooks?.[name];
  if (!hook) {
    return;
  }
  try {
    await (hook as (...args: any[]) => any)(...args);
  } catch (error) {
    logger.error(`Error in hook ${name}: ${error}`);
    throw error;
  }
};
