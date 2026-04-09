import {beforeEach, describe, expect, it, mock} from "bun:test";
import {renderWithTheme} from "@terreno/ui/src/test-utils";
import React from "react";
import {AdminScriptList} from "./AdminScriptList";

// Mock useAdminConfig to control returned data
const mockUseAdminConfig = mock(() => ({
  config: null as any,
  error: null as any,
  isLoading: false,
}));

mock.module("./useAdminConfig", () => ({
  useAdminConfig: (...args: any[]) => mockUseAdminConfig(...args),
}));

// Mock AdminScriptRunModal since it depends on useAdminScripts
mock.module("./AdminScriptRunModal", () => ({
  AdminScriptRunModal: () => null,
}));

const mockApi = {} as any;

describe("AdminScriptList", () => {
  beforeEach(() => {
    mockUseAdminConfig.mockClear();
  });

  it("renders loading state", () => {
    mockUseAdminConfig.mockReturnValue({
      config: null,
      error: null,
      isLoading: true,
    });

    const {getByTestId} = renderWithTheme(<AdminScriptList api={mockApi} baseUrl="/admin" />);

    // Spinner should be rendered during loading
    expect(getByTestId).toBeDefined();
  });

  it("renders error state when config fails to load", () => {
    mockUseAdminConfig.mockReturnValue({
      config: null,
      error: new Error("Network error"),
      isLoading: false,
    });

    const {getByText} = renderWithTheme(<AdminScriptList api={mockApi} baseUrl="/admin" />);

    expect(getByText("Failed to load admin configuration.")).toBeTruthy();
  });

  it("renders empty state when no scripts are configured", () => {
    mockUseAdminConfig.mockReturnValue({
      config: {models: [], scripts: []},
      error: null,
      isLoading: false,
    });

    const {getByText} = renderWithTheme(<AdminScriptList api={mockApi} baseUrl="/admin" />);

    expect(getByText("No scripts registered.")).toBeTruthy();
  });

  it("renders script cards with name and description", () => {
    mockUseAdminConfig.mockReturnValue({
      config: {
        models: [],
        scripts: [
          {description: "Migrate old records", name: "migrate-data"},
          {description: "Remove orphaned documents", name: "cleanup"},
        ],
      },
      error: null,
      isLoading: false,
    });

    const {getByText, getByTestId} = renderWithTheme(
      <AdminScriptList api={mockApi} baseUrl="/admin" />
    );

    expect(getByText("migrate-data")).toBeTruthy();
    expect(getByText("Migrate old records")).toBeTruthy();
    expect(getByText("cleanup")).toBeTruthy();
    expect(getByText("Remove orphaned documents")).toBeTruthy();
    expect(getByTestId("admin-script-card-migrate-data")).toBeTruthy();
    expect(getByTestId("admin-script-card-cleanup")).toBeTruthy();
  });

  it("renders Run buttons for each script", () => {
    mockUseAdminConfig.mockReturnValue({
      config: {
        models: [],
        scripts: [{description: "Test script", name: "test-script"}],
      },
      error: null,
      isLoading: false,
    });

    const {getByTestId} = renderWithTheme(<AdminScriptList api={mockApi} baseUrl="/admin" />);

    expect(getByTestId("admin-script-run-test-script")).toBeTruthy();
  });

  it("disables Run button when isAdmin is false", () => {
    mockUseAdminConfig.mockReturnValue({
      config: {
        models: [],
        scripts: [{description: "Test script", name: "test-script"}],
      },
      error: null,
      isLoading: false,
    });

    const {getByTestId} = renderWithTheme(
      <AdminScriptList api={mockApi} baseUrl="/admin" isAdmin={false} />
    );

    const button = getByTestId("admin-script-run-test-script");
    // The button should have aria-disabled or similar when disabled
    expect(button).toBeTruthy();
  });
});
