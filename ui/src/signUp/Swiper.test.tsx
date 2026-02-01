import {describe, expect, it, mock} from "bun:test";
import {fireEvent, waitFor} from "@testing-library/react-native";
import {Text} from "react-native";

import {renderWithTheme} from "../test-utils";
import {Swiper} from "./Swiper";
import type {OnboardingPage} from "./signUpTypes";

describe("Swiper", () => {
  const defaultPages: OnboardingPage[] = [
    {header: "Welcome", id: "welcome", subheader: "Get started with our app"},
    {header: "Features", id: "features", subheader: "Discover what we offer"},
    {header: "Ready", id: "ready", subheader: "Create your account"},
  ];

  const defaultProps = {
    onComplete: mock(() => {}),
    pages: defaultPages,
  };

  describe("rendering", () => {
    it("should render the first page initially", () => {
      const {getByText} = renderWithTheme(<Swiper {...defaultProps} />);

      expect(getByText("Welcome")).toBeTruthy();
      expect(getByText("Get started with our app")).toBeTruthy();
    });

    it("should render navigation buttons", () => {
      const {getByText} = renderWithTheme(<Swiper {...defaultProps} />);

      expect(getByText("Skip")).toBeTruthy();
      expect(getByText("Next")).toBeTruthy();
    });

    it("should render custom button text", () => {
      const {getByText} = renderWithTheme(
        <Swiper
          {...defaultProps}
          getStartedText="Let's Go"
          nextText="Continue"
          skipText="Not Now"
        />
      );

      expect(getByText("Not Now")).toBeTruthy();
      expect(getByText("Continue")).toBeTruthy();
    });
  });

  describe("page content", () => {
    it("should render page with header and subheader", () => {
      const {getByText} = renderWithTheme(<Swiper {...defaultProps} />);

      expect(getByText("Welcome")).toBeTruthy();
      expect(getByText("Get started with our app")).toBeTruthy();
    });

    it("should render custom content when renderContent is provided", () => {
      const customPages: OnboardingPage[] = [
        {
          id: "custom",
          renderContent: () => <Text>Custom Content Here</Text>,
        },
      ];

      const {getByText} = renderWithTheme(
        <Swiper onComplete={mock(() => {})} pages={customPages} />
      );

      expect(getByText("Custom Content Here")).toBeTruthy();
    });

    it("should handle pages without optional content", () => {
      const minimalPages: OnboardingPage[] = [{id: "minimal"}];

      const {root} = renderWithTheme(<Swiper onComplete={mock(() => {})} pages={minimalPages} />);

      expect(root).toBeTruthy();
    });
  });

  describe("navigation", () => {
    it("should call onComplete when Skip is pressed", async () => {
      const mockOnComplete = mock(() => {});
      const {getByText} = renderWithTheme(<Swiper {...defaultProps} onComplete={mockOnComplete} />);

      const skipButton = getByText("Skip");
      fireEvent.press(skipButton);

      // Button uses debounce, so we wait for the callback
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });

    it("should show Get Started on the last page", () => {
      const singlePage: OnboardingPage[] = [{header: "Only Page", id: "only"}];

      const {getByText, queryByText} = renderWithTheme(
        <Swiper onComplete={mock(() => {})} pages={singlePage} />
      );

      expect(getByText("Get Started")).toBeTruthy();
      expect(queryByText("Skip")).toBeNull();
      expect(queryByText("Next")).toBeNull();
    });

    it("should call onComplete when Get Started is pressed on last page", async () => {
      const mockOnComplete = mock(() => {});
      const singlePage: OnboardingPage[] = [{header: "Only Page", id: "only"}];

      const {getByText} = renderWithTheme(
        <Swiper onComplete={mockOnComplete} pages={singlePage} />
      );

      const getStartedButton = getByText("Get Started");
      fireEvent.press(getStartedButton);

      // Button uses debounce, so we wait for the callback
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });
  });

  describe("pagination", () => {
    it("should render pagination dots", () => {
      const {root} = renderWithTheme(<Swiper {...defaultProps} />);

      expect(root).toBeTruthy();
    });
  });

  describe("edge cases", () => {
    it("should handle empty pages array gracefully", () => {
      const {root} = renderWithTheme(<Swiper onComplete={mock(() => {})} pages={[]} />);

      expect(root).toBeTruthy();
    });

    it("should handle single page", () => {
      const singlePage: OnboardingPage[] = [{header: "Single", id: "single"}];

      const {getByText} = renderWithTheme(
        <Swiper onComplete={mock(() => {})} pages={singlePage} />
      );

      expect(getByText("Single")).toBeTruthy();
      expect(getByText("Get Started")).toBeTruthy();
    });

    it("should handle many pages", () => {
      const manyPages: OnboardingPage[] = Array.from({length: 10}, (_, i) => ({
        header: `Page ${i + 1}`,
        id: `page-${i}`,
      }));

      const {getByText} = renderWithTheme(<Swiper onComplete={mock(() => {})} pages={manyPages} />);

      expect(getByText("Page 1")).toBeTruthy();
    });
  });

  describe("snapshots", () => {
    it("should match snapshot with default props", () => {
      const component = renderWithTheme(<Swiper {...defaultProps} />);
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot with custom button text", () => {
      const component = renderWithTheme(
        <Swiper
          {...defaultProps}
          getStartedText="Begin"
          nextText="Continue"
          skipText="Maybe Later"
        />
      );
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot with single page (shows Get Started)", () => {
      const singlePage: OnboardingPage[] = [{header: "Welcome", id: "welcome"}];
      const component = renderWithTheme(<Swiper onComplete={mock(() => {})} pages={singlePage} />);
      expect(component.toJSON()).toMatchSnapshot();
    });

    it("should match snapshot with custom render content", () => {
      const customPages: OnboardingPage[] = [
        {
          id: "custom",
          renderContent: () => <Text>Custom onboarding content</Text>,
        },
      ];
      const component = renderWithTheme(<Swiper onComplete={mock(() => {})} pages={customPages} />);
      expect(component.toJSON()).toMatchSnapshot();
    });
  });
});
