// noExplicitAny: test mocks use type-erased RTK Query API doubles and UNSAFE_root traversal
// biome-ignore-all lint/suspicious/noExplicitAny: test mock typing
import {beforeEach, describe, expect, it, mock} from "bun:test";
import {act, fireEvent} from "@testing-library/react-native";
import React from "react";
import type {ReactTestInstance} from "react-test-renderer";
import {renderWithTheme} from "../../ui/src/test-utils";
import {configureUseAdminApiDouble, resetUseAdminApiDouble} from "./testing/useAdminApiDouble";
import type {AdminApi} from "./types";

interface State {
  formData: Record<string, unknown> | null;
  isFormLoading: boolean;
}
const state: State = {formData: null, isFormLoading: false};
const createCalls: unknown[] = [];
const updateCalls: unknown[] = [];
const publishCalls: string[] = [];
const archiveCalls: string[] = [];
let createImpl: (body: unknown) => Promise<unknown> = async (b) => ({
  _id: "new-id",
  ...(b as Record<string, unknown>),
});
let updateImpl: (args: unknown) => Promise<unknown> = async (a) => ({
  _id: (a as Record<string, unknown>).id,
});
let publishImpl: (id: string) => Promise<unknown> = async () => ({data: {status: "published"}});
let archiveImpl: (id: string) => Promise<unknown> = async () => ({data: {status: "archived"}});

const mutationSpecs: unknown[] = [];
const makeApi = () => ({
  injectEndpoints: ({endpoints}: {endpoints: (b: unknown) => Record<string, unknown>}) => {
    endpoints({
      mutation: (spec: Record<string, unknown>) => {
        if (typeof spec?.query === "function") {
          mutationSpecs.push(spec.query("announcement-id"));
        }
        return spec;
      },
      query: (spec: unknown) => spec,
    });
    return {
      useArchiveAnnouncementMutation: () => [
        (id: string) => ({
          unwrap: async () => {
            archiveCalls.push(id);
            return archiveImpl(id);
          },
        }),
        {isLoading: false},
      ],
      usePublishAnnouncementMutation: () => [
        (id: string) => ({
          unwrap: async () => {
            publishCalls.push(id);
            return publishImpl(id);
          },
        }),
        {isLoading: false},
      ],
    };
  },
});

import {AnnouncementEditor} from "./AnnouncementEditor";

const press = async (el: ReactTestInstance): Promise<void> => {
  await act(async () => {
    fireEvent.press(el);
    await new Promise((r) => setTimeout(r, 150));
  });
};

describe("AnnouncementEditor", () => {
  beforeEach(() => {
    resetUseAdminApiDouble();
    configureUseAdminApiDouble({
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
    });
    state.formData = null;
    state.isFormLoading = false;
    createCalls.length = 0;
    updateCalls.length = 0;
    publishCalls.length = 0;
    archiveCalls.length = 0;
    mutationSpecs.length = 0;
    createImpl = async (b) => ({_id: "new-id", ...(b as Record<string, unknown>)});
    updateImpl = async (a) => ({_id: (a as Record<string, unknown>).id});
    publishImpl = async () => ({data: {status: "published"}});
    archiveImpl = async () => ({data: {status: "archived"}});
  });

  it("renders loading state in edit mode", () => {
    state.isFormLoading = true;
    const {toJSON} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="a1" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("survives the loading → loaded transition without a hook-order error", async () => {
    state.isFormLoading = true;
    const {rerender, getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="a1" />
    );
    await act(async () => {
      state.isFormLoading = false;
      state.formData = {
        audience: {tiers: ["all"]},
        body: "Body",
        platforms: ["web"],
        priority: 1,
        requiresAcknowledgement: true,
        status: "draft",
        title: "Loaded",
        version: 1,
      };
      rerender(
        <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="a1" />
      );
    });
    expect(getByTestId("announcement-title-input")).toBeDefined();
  });

  it("renders create mode with default values", () => {
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" />
    );
    expect(getByTestId("announcement-title-input")).toBeDefined();
  });

  it("fails validation without title or body", async () => {
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" />
    );
    await press(getByTestId("announcement-save-button"));
    expect(createCalls.length).toBe(0);
  });

  it("creates an announcement on save", async () => {
    const onSave = mock((_: unknown) => undefined);
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" onSave={onSave} />
    );
    await act(async () => {
      fireEvent.changeText(getByTestId("announcement-title-input"), "Hello");
      fireEvent.changeText(getByTestId("announcement-body-input-input"), "World");
      await new Promise((r) => setTimeout(r, 50));
    });
    await press(getByTestId("announcement-save-button"));
    expect(createCalls.length).toBe(1);
    expect((createCalls[0] as Record<string, unknown>).title).toBe("Hello");
    expect((createCalls[0] as Record<string, unknown>).status).toBe("draft");
    expect(onSave).toHaveBeenCalled();
  });

  it("loads form data in edit mode and saves an update", async () => {
    state.formData = {
      audience: {},
      body: "Body",
      platforms: ["ios", "web"],
      priority: 2,
      requiresAcknowledgement: false,
      status: "draft",
      title: "Draft",
      version: 1,
    };
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="a1" />
    );
    await press(getByTestId("announcement-save-button"));
    expect(updateCalls.length).toBe(1);
    expect((updateCalls[0] as Record<string, unknown>).id).toBe("a1");
    expect(
      ((updateCalls[0] as Record<string, unknown>).body as Record<string, unknown>).status
    ).toBe("draft");
  });

  it("publishes a draft announcement", async () => {
    state.formData = {body: "B", status: "draft", title: "T"};
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="a1" />
    );
    await press(getByTestId("announcement-publish-button"));
    expect(publishCalls).toEqual(["a1"]);
  });

  it("archives a published announcement", async () => {
    state.formData = {body: "B", status: "published", title: "T", version: 1};
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="a1" />
    );
    await press(getByTestId("announcement-archive-button"));
    expect(archiveCalls).toEqual(["a1"]);
  });

  it("rejects invalid audience JSON", async () => {
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" />
    );
    await act(async () => {
      fireEvent.changeText(getByTestId("announcement-title-input"), "Title");
      fireEvent.changeText(getByTestId("announcement-body-input-input"), "Body");
      fireEvent.changeText(getByTestId("announcement-audience-input"), "{bad json");
      await new Promise((r) => setTimeout(r, 50));
    });
    await press(getByTestId("announcement-save-button"));
    expect(createCalls.length).toBe(0);
  });

  it("injects publish and archive mutation URLs", () => {
    renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="a1" />
    );
    const urls = mutationSpecs.map((spec) => (spec as {url?: string}).url);
    expect(urls).toContain("/announcements/announcement-id/publish");
    expect(urls).toContain("/announcements/announcement-id/archive");
  });

  it("invokes onCancel from the cancel button", async () => {
    const onCancel = mock(() => undefined);
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor
        api={makeApi() as unknown as AdminApi}
        baseUrl="/admin"
        onCancel={onCancel}
      />
    );
    await press(getByTestId("announcement-cancel-button"));
    expect(onCancel).toHaveBeenCalled();
  });

  it("shows published and archived status labels in edit mode", async () => {
    state.formData = {
      body: "Body",
      status: "published",
      title: "Published title",
      version: 3,
    };
    const published = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="a1" />
    );
    expect(published.getByText("Published (v3)")).toBeDefined();

    state.formData = {body: "Body", status: "archived", title: "Archived title", version: 2};
    const archived = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="a2" />
    );
    expect(archived.getByText("Archived")).toBeDefined();
  });

  it("creates announcements with a primary action", async () => {
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" />
    );
    await act(async () => {
      fireEvent.changeText(getByTestId("announcement-title-input"), "Title");
      fireEvent.changeText(getByTestId("announcement-body-input-input"), "Body");
      fireEvent.changeText(getByTestId("announcement-primary-label-input"), "Read more");
      fireEvent.changeText(
        getByTestId("announcement-primary-url-input"),
        "https://example.com/docs"
      );
      await new Promise((r) => setTimeout(r, 50));
    });
    await press(getByTestId("announcement-save-button"));
    expect(
      (createCalls[0] as {primaryAction?: {label: string; url: string}}).primaryAction
    ).toEqual({
      label: "Read more",
      url: "https://example.com/docs",
    });
  });

  it("surfaces create failures without throwing", async () => {
    createImpl = async () => {
      throw new Error("create failed");
    };
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" />
    );
    await act(async () => {
      fireEvent.changeText(getByTestId("announcement-title-input"), "Title");
      fireEvent.changeText(getByTestId("announcement-body-input-input"), "Body");
      await new Promise((r) => setTimeout(r, 50));
    });
    await press(getByTestId("announcement-save-button"));
    expect(createCalls.length).toBe(1);
  });

  it("surfaces archive failures without throwing", async () => {
    archiveImpl = async () => {
      throw new Error("archive failed");
    };
    state.formData = {body: "B", status: "published", title: "T", version: 1};
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="a1" />
    );
    await press(getByTestId("announcement-archive-button"));
    expect(archiveCalls).toEqual(["a1"]);
  });

  it("surfaces publish failures without throwing", async () => {
    publishImpl = async () => {
      throw new Error("publish failed");
    };
    state.formData = {body: "B", status: "draft", title: "T"};
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="a1" />
    );
    await press(getByTestId("announcement-publish-button"));
    expect(publishCalls).toEqual(["a1"]);
  });

  it("fails validation when the body is empty", async () => {
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" />
    );
    await act(async () => {
      fireEvent.changeText(getByTestId("announcement-title-input"), "Title only");
      await new Promise((r) => setTimeout(r, 50));
    });
    await press(getByTestId("announcement-save-button"));
    expect(createCalls.length).toBe(0);
  });

  it("rejects a partial primary action", async () => {
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" />
    );
    await act(async () => {
      fireEvent.changeText(getByTestId("announcement-title-input"), "Title");
      fireEvent.changeText(getByTestId("announcement-body-input-input"), "Body");
      fireEvent.changeText(getByTestId("announcement-primary-label-input"), "Learn more");
      await new Promise((r) => setTimeout(r, 50));
    });
    await press(getByTestId("announcement-save-button"));
    expect(createCalls.length).toBe(0);
  });

  it("toggles delivery platforms", async () => {
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" />
    );
    await press(getByTestId("announcement-platform-ios-clickable"));
    await act(async () => {
      fireEvent.changeText(getByTestId("announcement-title-input"), "Title");
      fireEvent.changeText(getByTestId("announcement-body-input-input"), "Body");
      await new Promise((r) => setTimeout(r, 50));
    });
    await press(getByTestId("announcement-save-button"));
    const platforms = (createCalls[0] as {platforms?: string[]}).platforms ?? [];
    expect(platforms.includes("ios")).toBe(false);
    expect(platforms.includes("android")).toBe(true);
    expect(platforms.includes("web")).toBe(true);
  });

  it("ignores invalid schedule dates when loading an announcement", async () => {
    state.formData = {
      body: "Body",
      expiresAt: "not-a-date",
      publishAt: "also-invalid",
      status: "draft",
      title: "Scheduled",
    };
    const {getByTestId} = renderWithTheme(
      <AnnouncementEditor api={makeApi() as unknown as AdminApi} baseUrl="/admin" id="a1" />
    );
    await press(getByTestId("announcement-save-button"));
    expect(updateCalls.length).toBe(1);
    expect(getByTestId("announcement-title-input")).toBeDefined();
  });
});
