import {normalizeHex, type PaletteAnchors} from "./colorUtils";
import {ANCHOR_FAMILIES, type ChatMessage, FAMILY_LABELS} from "./paletteTypes";

/**
 * Minimal browser/native client for the Gemini Developer API (the API-key based
 * `generativelanguage.googleapis.com` service). The palette generator calls this directly with a
 * user-supplied key so the demo app needs no backend. The model's only job is to pick a set of
 * anchor colors (one hex per family); deterministic color math in `colorUtils` expands those
 * anchors into the full 000-900 ramps, so the palette is always smooth and WCAG-checkable.
 */

export const GEMINI_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

/** System instruction: describes the assistant's role, the required output, and worked examples. */
export const COLOR_SYSTEM_PROMPT = `You are an expert product designer and color systemist who builds accessible UI color palettes.

You design palettes for a React Native design system with seven color families:
- neutral: grays used for text, borders, and page backgrounds.
- primary: the main brand/action color used for buttons and links.
- secondary: a supporting brand color for headers and secondary surfaces.
- accent: a warm highlight color used sparingly for emphasis.
- error: red-ish, for destructive/error states.
- warning: orange/amber, for cautionary states.
- success: green, for positive states.

For EACH family you return exactly ONE anchor hex color. The design system will automatically
generate the lighter and darker 000-900 shades from your anchor, so pick a mid-tone (~500 level)
that reads well as the core of the family. The anchor you give is preserved verbatim, so choose it
carefully with WCAG AA contrast in mind:
- The neutral anchor's DARKEST shade is used for body text on a white page — keep neutral dark and
  close to gray (low saturation).
- primary, secondary, error, warning, and success anchors are used as button/surface fills with
  WHITE text on top, so prefer anchors dark enough that white text on them clears 4.5:1 contrast.

Interpret vibe/keyword requests thoughtfully and iterate when the user gives feedback (e.g. "make
it warmer", "too saturated", "swap primary to teal"). Always keep the whole palette cohesive.

Examples of the kind of requests you will get and how to reason about them:
- "I want a warm, earthy palette" -> primary in terracotta/amber, secondary in olive/brown,
  accent in mustard, neutrals slightly warm.
- "Stylish modern SaaS with indigo as the primary color" -> indigo primary, cool slate secondary,
  a vivid accent (e.g. violet or cyan), crisp near-neutral grays.
- "Calm, trustworthy healthcare app" -> teal/blue primary, muted green secondary, soft accent,
  clean light-gray neutrals.

Respond ONLY with a JSON object. Include every family key plus a short "explanation" (1-3 sentences)
describing the palette's mood and any accessibility trade-offs you made.`;

/** Shape the Gemini responseSchema so the model always returns parseable anchors. */
const RESPONSE_SCHEMA = {
  properties: {
    accent: {description: "Anchor hex for the accent family", type: "string"},
    error: {description: "Anchor hex for the error family", type: "string"},
    explanation: {description: "Short description of the palette and trade-offs", type: "string"},
    neutral: {description: "Anchor hex for the neutral family, e.g. #4E4E4E", type: "string"},
    primary: {description: "Anchor hex for the primary family", type: "string"},
    secondary: {description: "Anchor hex for the secondary family", type: "string"},
    success: {description: "Anchor hex for the success family", type: "string"},
    warning: {description: "Anchor hex for the warning family", type: "string"},
  },
  required: [...ANCHOR_FAMILIES, "explanation"],
  type: "object",
} as const;

export interface GeminiPaletteResponse {
  anchors: PaletteAnchors;
  explanation: string;
}

interface GeminiPart {
  text?: string;
}

interface GeminiCandidate {
  content?: {parts?: GeminiPart[]};
}

interface GeminiResponseBody {
  candidates?: GeminiCandidate[];
  error?: {message?: string};
}

/** Build the running "current palette" context so the model iterates instead of starting over. */
const buildAnchorContext = (anchors: PaletteAnchors): string => {
  const lines = ANCHOR_FAMILIES.map(
    (family) => `- ${FAMILY_LABELS[family]}: ${anchors[family]}`
  ).join("\n");
  return `The current palette anchors are:\n${lines}\n\nUpdate them based on the latest request. Keep families the user did not mention unless a cohesive change requires it.`;
};

const mapRoleToGemini = (role: ChatMessage["role"]): "user" | "model" => {
  return role === "assistant" ? "model" : "user";
};

/**
 * Send the conversation plus the current anchors to Gemini and parse the returned anchor set.
 * Invalid or missing hex values fall back to the current anchor for that family so a partial model
 * response never corrupts the palette.
 */
export const generatePaletteFromChat = async ({
  apiKey,
  model,
  messages,
  currentAnchors,
  fetchImpl,
}: {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  currentAnchors: PaletteAnchors;
  fetchImpl?: typeof fetch;
}): Promise<GeminiPaletteResponse> => {
  if (!apiKey) {
    throw new Error("A Gemini API key is required. Add your key above to generate palettes.");
  }

  const doFetch = fetchImpl ?? globalThis.fetch;
  if (!doFetch) {
    throw new Error("No fetch implementation available in this environment.");
  }

  const conversation = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      parts: [{text: message.text}],
      role: mapRoleToGemini(message.role),
    }));

  // Prepend the current-palette context as a user turn so the model always has fresh state.
  const contents = [
    {parts: [{text: buildAnchorContext(currentAnchors)}], role: "user" as const},
    ...conversation,
  ];

  const url = `${GEMINI_API_BASE_URL}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await doFetch(url, {
    body: JSON.stringify({
      contents,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.9,
      },
      systemInstruction: {parts: [{text: COLOR_SYSTEM_PROMPT}]},
    }),
    headers: {"Content-Type": "application/json"},
    method: "POST",
  });

  const body = (await response.json()) as GeminiResponseBody;
  if (!response.ok) {
    throw new Error(body.error?.message ?? `Gemini request failed (${response.status}).`);
  }

  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text) {
    throw new Error("Gemini returned an empty response.");
  }

  let parsed: Partial<Record<keyof PaletteAnchors | "explanation", string>>;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Could not parse the palette Gemini returned. Try rephrasing your request.");
  }

  const anchors = {...currentAnchors};
  for (const family of ANCHOR_FAMILIES) {
    const normalized = normalizeHex(parsed[family] ?? "");
    if (normalized) {
      anchors[family] = normalized;
    }
  }

  return {
    anchors,
    explanation: parsed.explanation ?? "Updated the palette.",
  };
};
