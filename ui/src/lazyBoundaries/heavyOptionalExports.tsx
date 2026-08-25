import {createLazyComponentExport, createLazyNamedExport} from "./createLazyComponentExport";

export const AIRequestExplorer = createLazyNamedExport(
  () => import("../AIRequestExplorer"),
  "AIRequestExplorer"
);

export const AiSuggestionBox = createLazyNamedExport(
  () => import("../AiSuggestionBox"),
  "AiSuggestionBox"
);

export const AttachmentPreview = createLazyNamedExport(
  () => import("../AttachmentPreview"),
  "AttachmentPreview"
);

export const ConflictSheet = createLazyNamedExport(
  () => import("../ConflictSheet"),
  "ConflictSheet"
);

export const ConsentFormScreen = createLazyNamedExport(
  () => import("../ConsentFormScreen"),
  "ConsentFormScreen"
);

export const ConsentNavigator = createLazyNamedExport(
  () => import("../ConsentNavigator"),
  "ConsentNavigator"
);

export const DraggableList = createLazyNamedExport(
  () => import("../DraggableList"),
  "DraggableList"
);

const EMOJI_SELECTOR_DEFAULT_PROPS = {
  category: {
    name: "All",
    symbol: null,
  },
  columns: 6,
  placeholder: "Search...",
  showHistory: false,
  showSearchBar: true,
  showSectionTitles: true,
  showTabs: true,
  theme: "#007AFF",
};

export const EmojiSelector = createLazyComponentExport(
  () => import("../EmojiSelector").then((moduleNamespace) => ({default: moduleNamespace.default})),
  {defaultProps: EMOJI_SELECTOR_DEFAULT_PROPS}
);

export const GPTChat = createLazyNamedExport(() => import("../GPTChat"), "GPTChat");

export const GPTMemoryModal = createLazyNamedExport(
  () => import("../GPTMemoryModal"),
  "GPTMemoryModal"
);

export const MarkdownEditor = createLazyNamedExport(
  () => import("../MarkdownEditor"),
  "MarkdownEditor"
);

export const MarkdownEditorField = createLazyNamedExport(
  () => import("../MarkdownEditorField"),
  "MarkdownEditorField"
);

export const UpgradeRequiredScreen = createLazyNamedExport(
  () => import("../UpgradeRequiredScreen"),
  "UpgradeRequiredScreen"
);
