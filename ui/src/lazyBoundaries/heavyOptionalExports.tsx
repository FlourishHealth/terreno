import type {AIRequestExplorer as AIRequestExplorerComponent} from "../AIRequestExplorer";
import type {AiSuggestionBox as AiSuggestionBoxComponent} from "../AiSuggestionBox";
import type {AttachmentPreview as AttachmentPreviewComponent} from "../AttachmentPreview";
import type {ConflictSheet as ConflictSheetComponent} from "../ConflictSheet";
import type {ConsentFormScreen as ConsentFormScreenComponent} from "../ConsentFormScreen";
import type {ConsentNavigator as ConsentNavigatorComponent} from "../ConsentNavigator";
import type {DraggableList as DraggableListComponent} from "../DraggableList";
import type EmojiSelectorComponent from "../EmojiSelector";
import type {GPTChat as GPTChatComponent} from "../GPTChat";
import type {GPTMemoryModal as GPTMemoryModalComponent} from "../GPTMemoryModal";
import type {MarkdownEditor as MarkdownEditorComponent} from "../MarkdownEditor";
import type {MarkdownEditorField as MarkdownEditorFieldComponent} from "../MarkdownEditorField";
import type {UpgradeRequiredScreen as UpgradeRequiredScreenComponent} from "../UpgradeRequiredScreen";
import {Categories} from "../emojiCategories";
import {createLazyComponentExport, createLazyNamedExport} from "./createLazyComponentExport";

export const heavyOptionalModuleFactories = {
  AIRequestExplorer: () => import("../AIRequestExplorer"),
  AiSuggestionBox: () => import("../AiSuggestionBox"),
  AttachmentPreview: () => import("../AttachmentPreview"),
  ConflictSheet: () => import("../ConflictSheet"),
  ConsentFormScreen: () => import("../ConsentFormScreen"),
  ConsentNavigator: () => import("../ConsentNavigator"),
  DraggableList: () => import("../DraggableList"),
  EmojiSelector: () => import("../EmojiSelector"),
  GPTChat: () => import("../GPTChat"),
  GPTMemoryModal: () => import("../GPTMemoryModal"),
  MarkdownEditor: () => import("../MarkdownEditor"),
  MarkdownEditorField: () => import("../MarkdownEditorField"),
  UpgradeRequiredScreen: () => import("../UpgradeRequiredScreen"),
} as const;

const EMOJI_SELECTOR_DEFAULT_PROPS = {
  category: Categories.all,
  columns: 6,
  placeholder: "Search...",
  showHistory: false,
  showSearchBar: true,
  showSectionTitles: true,
  showTabs: true,
  theme: "#007AFF",
};

export const AIRequestExplorer = createLazyNamedExport(
  heavyOptionalModuleFactories.AIRequestExplorer,
  "AIRequestExplorer"
) as unknown as typeof AIRequestExplorerComponent;

export const AiSuggestionBox = createLazyNamedExport(
  heavyOptionalModuleFactories.AiSuggestionBox,
  "AiSuggestionBox"
) as unknown as typeof AiSuggestionBoxComponent;

export const AttachmentPreview = createLazyNamedExport(
  heavyOptionalModuleFactories.AttachmentPreview,
  "AttachmentPreview"
) as unknown as typeof AttachmentPreviewComponent;

export const ConflictSheet = createLazyNamedExport(
  heavyOptionalModuleFactories.ConflictSheet,
  "ConflictSheet"
) as unknown as typeof ConflictSheetComponent;

export const ConsentFormScreen = createLazyNamedExport(
  heavyOptionalModuleFactories.ConsentFormScreen,
  "ConsentFormScreen"
) as unknown as typeof ConsentFormScreenComponent;

export const ConsentNavigator = createLazyNamedExport(
  heavyOptionalModuleFactories.ConsentNavigator,
  "ConsentNavigator"
) as unknown as typeof ConsentNavigatorComponent;

export const DraggableList = createLazyNamedExport(
  heavyOptionalModuleFactories.DraggableList,
  "DraggableList"
) as unknown as typeof DraggableListComponent;

export const EmojiSelector = createLazyComponentExport(
  heavyOptionalModuleFactories.EmojiSelector,
  {defaultProps: EMOJI_SELECTOR_DEFAULT_PROPS}
) as unknown as typeof EmojiSelectorComponent;

export const GPTChat = createLazyNamedExport(
  heavyOptionalModuleFactories.GPTChat,
  "GPTChat"
) as unknown as typeof GPTChatComponent;

export const GPTMemoryModal = createLazyNamedExport(
  heavyOptionalModuleFactories.GPTMemoryModal,
  "GPTMemoryModal"
) as unknown as typeof GPTMemoryModalComponent;

export const MarkdownEditor = createLazyNamedExport(
  heavyOptionalModuleFactories.MarkdownEditor,
  "MarkdownEditor"
) as unknown as typeof MarkdownEditorComponent;

export const MarkdownEditorField = createLazyNamedExport(
  heavyOptionalModuleFactories.MarkdownEditorField,
  "MarkdownEditorField"
) as unknown as typeof MarkdownEditorFieldComponent;

export const UpgradeRequiredScreen = createLazyNamedExport(
  heavyOptionalModuleFactories.UpgradeRequiredScreen,
  "UpgradeRequiredScreen"
) as unknown as typeof UpgradeRequiredScreenComponent;
