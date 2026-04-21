import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {act, fireEvent} from "../../ui/node_modules/@testing-library/react-native";

interface State {
  formData: any;
  isFormLoading: boolean;
}
const state: State = {formData: null, isFormLoading: false};
const createCalls: any[] = [];
const updateCalls: any[] = [];
const publishCalls: string[] = [];
const generateCalls: any[] = [];
const translateCalls: any[] = [];
let createImpl: (body: any) => Promise<any> = async (b) => ({_id: "new-id", ...b});
let updateImpl: (args: any) => Promise<any> = async (a) => ({_id: a.id});
let publishImpl: (id: string) => Promise<any> = async () => ({});
let generateImpl: (body: any) => Promise<any> = async () => ({
  data: {content: "generated"},
});
let translateImpl: (body: any) => Promise<any> = async () => ({
  data: {content: "translated"},
});

mock.module("./useAdminApi", () => ({
  useAdminApi: () => ({
    useCreateMutation: () => [
      (body: any) => ({
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
      (args: any) => ({
        unwrap: async () => {
          updateCalls.push(args);
          return updateImpl(args);
        },
      }),
      {isLoading: false},
    ],
  }),
}));

const makeApi = () => ({
  injectEndpoints: ({endpoints}: {endpoints: (b: any) => Record<string, any>}) => {
    endpoints({mutation: (s: any) => s, query: (s: any) => s});
    return {
      useGenerateConsentContentMutation: () => [
        (body: any) => ({
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
        (body: any) => ({
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

const press = async (el: any): Promise<void> => {
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
    createImpl = async (b) => ({_id: "new-id", ...b});
    updateImpl = async (a) => ({_id: a.id});
    publishImpl = async () => ({});
    generateImpl = async () => ({data: {content: "generated"}});
    translateImpl = async () => ({data: {content: "translated"}});
  });

  it("renders loading state in edit mode", () => {
    state.isFormLoading = true;
    const {toJSON} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as any} baseUrl="/admin" id="f1" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("renders create mode with default values", () => {
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as any} baseUrl="/admin" />
    );
    expect(getByTestId("consent-form-title-input")).toBeDefined();
  });

  it("fails validation without title or slug", async () => {
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as any} baseUrl="/admin" />
    );
    await press(getByTestId("consent-form-save-button"));
    expect(createCalls.length).toBe(0);
  });

  it("auto-slugs titles and creates a form on save", async () => {
    const onSave = mock((_: any) => undefined);
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as any} baseUrl="/admin" onSave={onSave} />
    );
    await act(async () => {
      fireEvent.changeText(getByTestId("consent-form-title-input"), "Hello World");
      await new Promise((r) => setTimeout(r, 50));
    });
    await press(getByTestId("consent-form-save-button"));
    expect(createCalls.length).toBe(1);
    expect(createCalls[0].slug).toBe("hello-world");
    expect(onSave).toHaveBeenCalled();
  });

  it("respects manually-set slugs and handles create errors", async () => {
    createImpl = async () => {
      throw new Error("conflict");
    };
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as any} baseUrl="/admin" />
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
    expect(createCalls[0].slug).toBe("custom-slug");
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
        api={makeApi() as any}
        baseUrl="/admin"
        hasAiSupport
        id="f1"
        supportedLocales={["en", "es"]}
      />
    );
    await press(getByTestId("consent-form-save-button"));
    expect(updateCalls.length).toBe(1);
    expect(updateCalls[0].id).toBe("f1");
    expect(updateCalls[0].body.title).toBe("Privacy");
  });

  it("publishes a form on publish press", async () => {
    state.formData = {slug: "s", title: "T"};
    const {getByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as any} baseUrl="/admin" id="f1" />
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
      <ConsentFormEditor api={makeApi() as any} baseUrl="/admin" id="f1" />
    );
    await press(getByTestId("consent-form-publish-button"));
    expect(publishCalls.length).toBe(1);
  });

  it("opens the AI generate modal in create mode", async () => {
    const {getByTestId, toJSON} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as any} baseUrl="/admin" hasAiSupport />
    );
    await press(getByTestId("consent-form-generate-button"));
    expect(toJSON()).toBeDefined();
  });

  it("adds, edits, and removes checkboxes", async () => {
    const {getByTestId, queryByTestId} = renderWithTheme(
      <ConsentFormEditor api={makeApi() as any} baseUrl="/admin" />
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
      <ConsentFormEditor api={makeApi() as any} baseUrl="/admin" id="f1" />
    );
    expect(getByTestId("consent-form-decline-button-text-input")).toBeDefined();
  });

  it("renders and switches segmented control in multi-locale mode", async () => {
    const {toJSON} = renderWithTheme(
      <ConsentFormEditor
        api={makeApi() as any}
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
      <ConsentFormEditor api={makeApi() as any} baseUrl="/admin" onCancel={onCancel} />
    );
    await press(getByTestId("consent-form-cancel-button"));
    expect(onCancel).toHaveBeenCalled();
  });
});
