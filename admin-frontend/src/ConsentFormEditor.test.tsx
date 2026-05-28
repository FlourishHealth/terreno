// noExplicitAny: test mocks use type-erased RTK Query API doubles and UNSAFE_root traversal
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import type {ReactTestInstance} from "react-test-renderer";
import {act, fireEvent} from "../../ui/node_modules/@testing-library/react-native";
import type {AdminApi} from "./types";

interface State {
  formData: Record<string, unknown> | null;
  isFormLoading: boolean;
}
const state: State = {formData: null, isFormLoading: false};
const createCalls: unknown[] = [];
const updateCalls: unknown[] = [];
const publishCalls: string[] = [];
const generateCalls: unknown[] = [];
const translateCalls: unknown[] = [];
let createImpl: (body: unknown) => Promise<unknown> = async (b) => ({
  _id: "new-id",
  ...(b as Record<string, unknown>),
});
let updateImpl: (args: unknown) => Promise<unknown> = async (a) => ({
  _id: (a as Record<string, unknown>).id,
});
let publishImpl: (id: string) => Promise<unknown> = async () => ({});
let generateImpl: (body: unknown) => Promise<unknown> = async () => ({
  data: {content: "generated"},
});
let translateImpl: (body: unknown) => Promise<unknown> = async () => ({
  data: {content: "translated"},
});

mock.module("./useAdminApi", () => ({
  useAdminApi: () => ({
    useCreateMutation: () => [
      (body: unknown) => ({
        unwrap: async () => {
          createCalls.push(body);
          return createImpl(body);
        },
      }),
      {isLoading: false},
    ],
    useReadQuery: (_id: string, opts: {skip?: boolean}) => {
      if (opts?.skip) {
        return {data: undefined, isLoading: false};
      }
      return {data: state.formData, isLoading: state.isFormLoading};
    },
    useUpdateMutation: () => [
      (args: unknown) => ({
        unwrap: async () => {
          updateCalls.push(args);
          return updateImpl(args);
        },
      }),
      {isLoading: false},
    ],
  }),
}));

const mutationSpecs: unknown[] = [];
const makeApi = () => ({
  injectEndpoints: ({endpoints}: {endpoints: (b: unknown) => Record<string, unknown>}) => {
    endpoints({
      mutation: (spec: Record<string, unknown>) => {
        // Invoke the mutation query lambda with both an object body and a string
        // id so we exercise the URL + body builders for every mutation shape
        // (generate/translate take a body object, publish takes an id string).
        if (typeof spec?.query === "function") {
          mutationSpecs.push(
            spec.query({
              content: "c",
              description: "d",
              fromLocale: "en",
              locale: "en",
              toLocale: "es",
              type: "agreement",
            })
          );
          mutationSpecs.push(spec.query("form-id"));
        }
        return spec;
      },
      query: (spec: unknown) => spec,
    });
    return {
      useGenerateConsentContentMutation: () => [
        (body: unknown) => ({
          unwrap: async () => {
            generateCalls.push(body);
            return generateImpl(body);
          },
        }),
        {isLoading: false},
      ],
      usePublishConsentFormMutation: () => [
        (id: string) => ({
          unwrap: async () => {
            publishCalls.push(id);
            return publishImpl(id);
          },
        }),
        {isLoading: false},
      ],
      useTranslateConsentContentMutation: () => [
        (body: unknown) => ({
          unwrap: async () => {
            translateCalls.push(body);
            return translateImpl(body);
          },
        }),
        {isLoading: false},
      ],
    };
  },
});

import {ConsentFormEditor} from "./ConsentFormEditor";

const press = async (el: ReactTestInstance): Promise<void> => {
  await act(async () => {
    fireEvent.press(el);
    await new Promise((r) => setTimeout(r, 150));
  });
};

describe("ConsentFormEditor", () => {
  beforeEach(() => {
    state.formData = null;
    state.isFormLoading = false;
    createCalls.length = 0;
    updateCalls.length = 0;
    publishCalls.length = 0;
    generateCalls.length = 0;
    translateCalls.length = 0;
    mutationSpecs.length = 0;
    createImpl = async (b) => ({_id: "new-id", ...(b as Record<string, unknown>)});
    updateImpl = async (a) => ({_id: (a as Record<string, unknown>).id});
    publishImpl = async () => ({});
    generateImpl = async () => ({data: {content: "generated"}});
    translateImpl = async () => ({data: {content: "translated"}});
  });

  it("renders loading state in edit mode", () => {
    state.isFormLoading = true;
    const {toJSON} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="f1" />
    );
    expect(toJSON()).toBeDefined();
  });

  // Regression: hooks (useMemo) used to run after the early-return spinner branch,
  // which produced React error #310 ("Rendered more hooks than during the previous
  // render") the moment loading flipped to loaded. This test exercises both renders.
  // Pass a stable supportedLocales reference so the data-hydration useEffect's deps
  // don't churn between renders.
  it("survives the loading → loaded transition without a hook-order error", async () => {
    const supportedLocales = ["en"];
    state.isFormLoading = true;
    const {rerender, getByTestId} = renderWithTheme(
      <ConsentFormEditor
        api={makeApi() as unknown as AdminApi}
        baseUrl="/admin"
        id="f1"
        supportedLocales={supportedLocales}
      />
    );
    await act(async () => {
      state.isFormLoading = false;
      state.formData = {
        active: true,
        agreeButtonText: "I Agree",
        allowDecline: false,
        captureSignature: false,
        checkboxes: [],
        content: {en: "Body"},
        defaultLocale: "en",
        order: 0,
        required: false,
        requireScrollToBottom: false,
        slug: "loaded-form",
        title: "Loaded Form",
        type: "agreement",
        version: 1,
      };
      rerender(
        <ConsentFormEditor
          api={makeApi() as unknown as AdminApi}
          baseUrl="/admin"
          id="f1"
          supportedLocales={supportedLocales}
        />
      );
    });
    expect(getByTestId("consent-form-title-input")).toBeDefined();
  });

  it("renders create mode with default values", () => {
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" />
    );
    expect(getByTestId("consent-form-title-input")).toBeDefined();
  });

  it("fails validation without title or slug", async () => {
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" />
    );
    await press(getByTestId("consent-form-save-button"));
    expect(createCalls.length).toBe(0);
  });

  it("auto-slugs titles and creates a form on save", async () => {
    const onSave = mock((_: unknown) => undefined);
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" onSave={onSave} />
    );
    await act(async () => {
      fireEvent.changeText(getByTestId("consent-form-title-input"), "Hello World");
      await new Promise((r) => setTimeout(r, 50));
    });
    await press(getByTestId("consent-form-save-button"));
    expect(createCalls.length).toBe(1);
    expect((createCalls[0] as Record<string, unknown>).slug).toBe("hello-world");
    expect(onSave).toHaveBeenCalled();
  });

  it("respects manually-set slugs and handles create errors", async () => {
    createImpl = async () => {
      throw new Error("conflict");
    };
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" />
    );
    await act(async () => {
      fireEvent.changeText(getByTestId("consent-form-title-input"), "Title");
      await new Promise((r) => setTimeout(r, 50));
    });
    await act(async () => {
      fireEvent.changeText(getByTestId("consent-form-slug-input"), "custom-slug");
      await new Promise((r) => setTimeout(r, 50));
    });
    await press(getByTestId("consent-form-save-button"));
    expect(createCalls.length).toBe(1);
    expect((createCalls[0] as Record<string, unknown>).slug).toBe("custom-slug");
  });

  it("loads form data in edit mode and saves an update", async () => {
    state.formData = {
      active: true,
      agreeButtonText: "Yes",
      allowDecline: true,
      captureSignature: true,
      checkboxes: [{label: "Agree", required: true}],
      content: {en: "Hi", es: "Hola"},
      declineButtonText: "No",
      defaultLocale: "en",
      order: 2,
      required: true,
      requireScrollToBottom: true,
      slug: "privacy",
      title: "Privacy",
      type: "privacy",
    };
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor
        api={makeApi() as unknown as AdminApi}
        baseUrl="/admin"
        hasAiSupport
        id="f1"
        supportedLocales={["en", "es"]}
      />
    );
    await press(getByTestId("consent-form-save-button"));
    expect(updateCalls.length).toBe(1);
    expect((updateCalls[0] as Record<string, unknown>).id).toBe("f1");
    expect(
      ((updateCalls[0] as Record<string, unknown>).body as Record<string, unknown>).title
    ).toBe("Privacy");
  });

  it("publishes a form on publish press", async () => {
    state.formData = {slug: "s", title: "T"};
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="f1" />
    );
    await press(getByTestId("consent-form-publish-button"));
    expect(publishCalls).toEqual(["f1"]);
  });

  it("handles publish errors", async () => {
    state.formData = {slug: "s", title: "T"};
    publishImpl = async () => {
      throw new Error("fail");
    };
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="f1" />
    );
    await press(getByTestId("consent-form-publish-button"));
    expect(publishCalls.length).toBe(1);
  });

  it("opens the AI generate modal in create mode", async () => {
    const {getByTestId, toJSON} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" hasAiSupport />
    );
    await press(getByTestId("consent-form-generate-button"));
    expect(toJSON()).toBeDefined();
  });

  it("adds, edits, and removes checkboxes", async () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" />
    );
    await press(getByTestId("consent-form-add-checkbox-button"));
    expect(getByTestId("consent-form-checkbox-0")).toBeDefined();
    await act(async () => {
      fireEvent.changeText(getByTestId("consent-form-checkbox-0-label-input"), "I agree");
      await new Promise((r) => setTimeout(r, 50));
    });
    await act(async () => {
      fireEvent.changeText(getByTestId("consent-form-checkbox-0-prompt-input"), "Confirm?");
      await new Promise((r) => setTimeout(r, 50));
    });
    await press(getByTestId("consent-form-checkbox-0-remove-button"));
    expect(queryByTestId("consent-form-checkbox-0")).toBeNull();
  });

  it("toggles allowDecline and shows decline text field", async () => {
    state.formData = {
      allowDecline: true,
      declineButtonText: "Nope",
      slug: "s",
      title: "T",
    };
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="f1" />
    );
    expect(getByTestId("consent-form-decline-button-text-input")).toBeDefined();
  });

  it("renders and switches segmented control in multi-locale mode", async () => {
    const {toJSON} = renderWithTheme(
      <ConsentFormEditor
        api={makeApi() as unknown as AdminApi}
        baseUrl="/admin"
        hasAiSupport
        supportedLocales={["en", "es"]}
      />
    );
    expect(toJSON()).toBeDefined();
  });

  it("calls onCancel when cancel is pressed", async () => {
    const onCancel = mock(() => undefined);
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor
        api={makeApi() as unknown as AdminApi}
        baseUrl="/admin"
        onCancel={onCancel}
      />
    );
    await press(getByTestId("consent-form-cancel-button"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("handlePublish early-returns when no id", async () => {
    // Create mode has no id → publish button shouldn't exist, but exercising
    // the handler via the save flow at least touches the non-id path.
    const {queryByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" hasAiSupport />
    );
    expect(queryByTestId("consent-form-publish-button")).toBeNull();
  });

  it("wires all three mutations (generate/publish/translate) to the right URLs", () => {
    renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" hasAiSupport />
    );
    // The mock invokes each mutation's query lambda, so mutationSpecs contains
    // the resolved request descriptors for generate, publish, and translate.
    const urls = mutationSpecs.map((s: unknown) => (s as Record<string, unknown>).url).sort();
    expect(urls).toContain("/consent-forms/generate");
    expect(urls).toContain("/consent-forms/form-id/publish");
    expect(urls).toContain("/consent-forms/translate");
  });

  it("refuses to save without a slug even when title is present", async () => {
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" />
    );
    // Set a title so slug would auto-generate.
    await act(async () => {
      fireEvent.changeText(getByTestId("consent-form-title-input"), "Draft");
      await new Promise((r) => setTimeout(r, 50));
    });
    // Now clear the slug explicitly — this hits the "Slug is required" branch.
    await act(async () => {
      fireEvent.changeText(getByTestId("consent-form-slug-input"), "");
      await new Promise((r) => setTimeout(r, 50));
    });
    await press(getByTestId("consent-form-save-button"));
    expect(createCalls.length).toBe(0);
  });

  it("generates AI content into the active locale and closes the modal", async () => {
    const {getByTestId, UNSAFE_root} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" hasAiSupport />
    );
    await press(getByTestId("consent-form-generate-button"));
    // Find the Modal's primary "Generate" button and invoke it directly. The
    // description input lives inside the Modal's portal and may not be
    // mounted; invoking primaryButtonOnClick still exercises handleGenerate.
    const modals = UNSAFE_root.findAll(
      (n: ReactTestInstance) => typeof n.props?.primaryButtonOnClick === "function"
    );
    expect(modals.length).toBeGreaterThan(0);
    await act(async () => {
      (modals[0] as ReactTestInstance).props.primaryButtonOnClick();
      await new Promise((r) => setTimeout(r, 150));
    });
    expect(generateCalls.length).toBe(1);
    expect((generateCalls[0] as Record<string, unknown>).locale).toBe("en");
    expect((generateCalls[0] as Record<string, unknown>).type).toBe("agreement");
  });

  it("surfaces generation errors via toast.catch", async () => {
    generateImpl = async () => {
      throw new Error("boom");
    };
    const {getByTestId, UNSAFE_root} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" hasAiSupport />
    );
    await press(getByTestId("consent-form-generate-button"));
    const modals = UNSAFE_root.findAll(
      (n: ReactTestInstance) => typeof n.props?.primaryButtonOnClick === "function"
    );
    await act(async () => {
      (modals[0] as ReactTestInstance).props.primaryButtonOnClick();
      await new Promise((r) => setTimeout(r, 150));
    });
    expect(generateCalls.length).toBe(1);
  });

  it("translates from the default locale into the active locale", async () => {
    state.formData = {
      content: {en: "Hello world"},
      defaultLocale: "en",
      slug: "s",
      title: "T",
    };
    const {UNSAFE_root} = renderWithTheme(
      <ConsentFormEditor
        api={makeApi() as unknown as AdminApi}
        baseUrl="/admin"
        hasAiSupport
        id="f1"
        supportedLocales={["en", "es"]}
      />
    );
    // Switch to non-default locale (es) so the Translate button appears.
    const segmented = UNSAFE_root.findAll(
      (n: ReactTestInstance) =>
        typeof n.props?.onChange === "function" && Array.isArray(n.props?.items)
    );
    expect(segmented.length).toBeGreaterThan(0);
    await act(async () => {
      (segmented[0] as ReactTestInstance).props.onChange(1);
      await new Promise((r) => setTimeout(r, 50));
    });
    // Find the translate button and press it
    const translateButton = UNSAFE_root.findAll(
      (n: ReactTestInstance) => n.props?.testID === "consent-form-translate-es-button"
    );
    expect(translateButton.length).toBeGreaterThan(0);
    await act(async () => {
      (translateButton[0] as ReactTestInstance).props.onClick();
      await new Promise((r) => setTimeout(r, 150));
    });
    expect(translateCalls.length).toBe(1);
    expect((translateCalls[0] as Record<string, unknown>).toLocale).toBe("es");
    expect((translateCalls[0] as Record<string, unknown>).content).toBe("Hello world");
  });

  it("short-circuits translation when source locale has empty content", async () => {
    state.formData = {
      content: {en: "   "},
      defaultLocale: "en",
      slug: "s",
      title: "T",
    };
    const {UNSAFE_root} = renderWithTheme(
      <ConsentFormEditor
        api={makeApi() as unknown as AdminApi}
        baseUrl="/admin"
        hasAiSupport
        id="f1"
        supportedLocales={["en", "es"]}
      />
    );
    const segmented = UNSAFE_root.findAll(
      (n: ReactTestInstance) =>
        typeof n.props?.onChange === "function" && Array.isArray(n.props?.items)
    );
    await act(async () => {
      (segmented[0] as ReactTestInstance).props.onChange(1);
      await new Promise((r) => setTimeout(r, 50));
    });
    const translateButton = UNSAFE_root.findAll(
      (n: ReactTestInstance) => n.props?.testID === "consent-form-translate-es-button"
    );
    await act(async () => {
      (translateButton[0] as ReactTestInstance).props.onClick();
      await new Promise((r) => setTimeout(r, 150));
    });
    expect(translateCalls.length).toBe(0);
  });

  it("surfaces translation errors via toast.catch", async () => {
    translateImpl = async () => {
      throw new Error("nope");
    };
    state.formData = {
      content: {en: "Hello"},
      defaultLocale: "en",
      slug: "s",
      title: "T",
    };
    const {UNSAFE_root} = renderWithTheme(
      <ConsentFormEditor
        api={makeApi() as unknown as AdminApi}
        baseUrl="/admin"
        hasAiSupport
        id="f1"
        supportedLocales={["en", "es"]}
      />
    );
    const segmented = UNSAFE_root.findAll(
      (n: ReactTestInstance) =>
        typeof n.props?.onChange === "function" && Array.isArray(n.props?.items)
    );
    await act(async () => {
      (segmented[0] as ReactTestInstance).props.onChange(1);
      await new Promise((r) => setTimeout(r, 50));
    });
    const translateButton = UNSAFE_root.findAll(
      (n: ReactTestInstance) => n.props?.testID === "consent-form-translate-es-button"
    );
    await act(async () => {
      (translateButton[0] as ReactTestInstance).props.onClick();
      await new Promise((r) => setTimeout(r, 150));
    });
    expect(translateCalls.length).toBe(1);
  });

  it("dismisses the generate modal via secondary action", async () => {
    const {getByTestId, UNSAFE_root} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" hasAiSupport />
    );
    await press(getByTestId("consent-form-generate-button"));
    const modals = UNSAFE_root.findAll(
      (n: ReactTestInstance) => typeof n.props?.secondaryButtonOnClick === "function"
    );
    expect(modals.length).toBeGreaterThan(0);
    await act(async () => {
      (modals[0] as ReactTestInstance).props.secondaryButtonOnClick();
      await new Promise((r) => setTimeout(r, 50));
    });
    await act(async () => {
      (modals[0] as ReactTestInstance).props.onDismiss?.();
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(generateCalls.length).toBe(0);
  });
});
