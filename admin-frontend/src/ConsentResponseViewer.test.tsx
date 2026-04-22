import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {act, fireEvent} from "../../ui/node_modules/@testing-library/react-native";

interface ReadState {
  data: any;
  isLoading: boolean;
}
const readState: ReadState = {data: undefined, isLoading: false};

mock.module("./useAdminApi", () => ({
  useAdminApi: () => ({
    useReadQuery: (_id: string, opts: {skip?: boolean}) => {
      if (opts?.skip) {
        return {data: undefined, isLoading: false};
      }
      return {data: readState.data, isLoading: readState.isLoading};
    },
  }),
}));

const pdfCalls: any[] = [];
let pdfImpl: (r: any) => Promise<void> = async () => {};
mock.module("./generateConsentPdf", () => ({
  generateConsentPdf: async (r: any) => {
    pdfCalls.push(r);
    return pdfImpl(r);
  },
}));

import {ConsentResponseViewer} from "./ConsentResponseViewer";

describe("ConsentResponseViewer", () => {
  beforeEach(() => {
    readState.data = undefined;
    readState.isLoading = false;
    pdfCalls.length = 0;
    pdfImpl = async () => {};
  });

  it("renders loading state", () => {
    readState.isLoading = true;
    const {toJSON} = renderWithTheme(
      <ConsentResponseViewer api={{} as any} baseUrl="/admin" id="r1" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("shows not-found state when there is no id / data", () => {
    const {getByText} = renderWithTheme(
      <ConsentResponseViewer api={{} as any} baseUrl="/admin" id="" />
    );
    expect(getByText(/Response not found\./)).toBeDefined();
  });

  it("renders a full response and triggers PDF download", async () => {
    readState.data = {
      agreed: true,
      agreedAt: "2024-01-02T03:04:05.000Z",
      checkboxValues: {0: true, 1: false},
      consentFormId: {title: "My Form"},
      contentSnapshot: "# Hello",
      formVersionSnapshot: {title: "My Form", version: 1},
      ipAddress: "127.0.0.1",
      locale: "en",
      signature: "data:image/png;base64,abc",
      userAgent: "jest",
      userId: {_id: "u1"},
    };
    const {getByText} = renderWithTheme(
      <ConsentResponseViewer api={{} as any} baseUrl="/admin" id="r1" />
    );
    await act(async () => {
      fireEvent.press(getByText("Download PDF"));
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(pdfCalls.length).toBe(1);
  });

  it("renders minimal declined response without optional sections", () => {
    readState.data = {
      agreed: false,
      consentFormId: "raw-id",
      userId: "u2",
    };
    const {toJSON} = renderWithTheme(
      <ConsentResponseViewer api={{} as any} baseUrl="/admin" id="r2" />
    );
    expect(toJSON()).toBeDefined();
  });

  it("handles PDF generation errors", async () => {
    readState.data = {agreed: true};
    pdfImpl = async () => {
      throw new Error("broken");
    };
    const {getByText} = renderWithTheme(
      <ConsentResponseViewer api={{} as any} baseUrl="/admin" id="r1" />
    );
    await act(async () => {
      fireEvent.press(getByText("Download PDF"));
      await new Promise((r) => setTimeout(r, 100));
    });
    expect(pdfCalls.length).toBe(1);
  });

  it("formats invalid dates gracefully", () => {
    readState.data = {agreed: true, agreedAt: "not-a-date"};
    const {toJSON} = renderWithTheme(
      <ConsentResponseViewer api={{} as any} baseUrl="/admin" id="r1" />
    );
    expect(toJSON()).toBeDefined();
  });
});
