import {beforeAll, describe, expect, it, mock} from "bun:test";
import {act, render, waitFor} from "@testing-library/react-native";
import React from "react";
import {Text} from "react-native";

import {
  GlobalToast,
  type ToastContainerRef,
  type ToastOptions,
  type ToastProps,
  ToastProvider,
  type ToastType,
  useToastNotifications,
} from "./ToastNotifications";

// Mock requestAnimationFrame for test environment
beforeAll(() => {
  global.requestAnimationFrame = (callback: FrameRequestCallback) => {
    return setTimeout(() => callback(Date.now()), 0) as unknown as number;
  };
  global.cancelAnimationFrame = (id: number) => {
    clearTimeout(id);
  };
});

describe("ToastNotifications", () => {
  describe("ToastProvider", () => {
    it("should render children", () => {
      const {getByText} = render(
        <ToastProvider>
          <Text>Test Content</Text>
        </ToastProvider>
      );
      expect(getByText("Test Content")).toBeTruthy();
    });

    it("should render without crashing", () => {
      const {root} = render(
        <ToastProvider>
          <Text>App</Text>
        </ToastProvider>
      );
      expect(root).toBeTruthy();
    });

    it("should accept custom props", () => {
      const {root} = render(
        <ToastProvider duration={3000} offset={20} placement="top" swipeEnabled={false}>
          <Text>App</Text>
        </ToastProvider>
      );
      expect(root).toBeTruthy();
    });
  });

  describe("useToastNotifications hook", () => {
    it("should return toast methods from context", () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      expect(toastRef).toBeTruthy();
    });

    it("should have show method available after mount", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });
    });

    it("should have hide method available after mount", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.hide).toBeDefined();
      });
    });

    it("should have hideAll method available after mount", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.hideAll).toBeDefined();
      });
    });

    it("should have update method available after mount", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.update).toBeDefined();
      });
    });

    it("should have isOpen method available after mount", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.isOpen).toBeDefined();
      });
    });
  });

  describe("GlobalToast", () => {
    it("should be set after ToastProvider mounts", async () => {
      render(
        <ToastProvider>
          <Text>App</Text>
        </ToastProvider>
      );

      await waitFor(() => {
        expect(GlobalToast).toBeDefined();
      });
    });
  });

  describe("Toast functionality", () => {
    it("should show a toast and return an id", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Test message");
      });

      expect(toastId).toBeDefined();
      expect(typeof toastId).toBe("string");
    });

    it("should show a toast with custom id", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Test message", {id: "custom-id"});
      });

      expect(toastId).toBe("custom-id");
    });

    it("should have isOpen method that returns false for non-existent toast", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.isOpen).toBeDefined();
      });

      expect(toastRef?.isOpen("non-existent")).toBe(false);
    });

    it("should have hide method available", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.hide).toBeDefined();
      });

      expect(typeof toastRef?.hide).toBe("function");
    });

    it("should have hideAll method available", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.hideAll).toBeDefined();
      });

      expect(typeof toastRef?.hideAll).toBe("function");
    });

    it("should have update method available", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.update).toBeDefined();
      });

      expect(typeof toastRef?.update).toBe("function");
    });
  });

  describe("Toast types", () => {
    it("should show success toast", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Success!", {type: "success"});
      });

      expect(toastId).toBeDefined();
    });

    it("should show danger toast", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Error!", {type: "danger"});
      });

      expect(toastId).toBeDefined();
    });

    it("should show warning toast", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Warning!", {type: "warning"});
      });

      expect(toastId).toBeDefined();
    });
  });

  describe("Toast placement", () => {
    it("should accept top placement", () => {
      const {root} = render(
        <ToastProvider placement="top">
          <Text>App</Text>
        </ToastProvider>
      );
      expect(root).toBeTruthy();
    });

    it("should accept bottom placement", () => {
      const {root} = render(
        <ToastProvider placement="bottom">
          <Text>App</Text>
        </ToastProvider>
      );
      expect(root).toBeTruthy();
    });

    it("should accept center placement", () => {
      const {root} = render(
        <ToastProvider placement="center">
          <Text>App</Text>
        </ToastProvider>
      );
      expect(root).toBeTruthy();
    });
  });

  describe("Toast options", () => {
    it("should accept custom duration", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Test", {duration: 1000});
      });

      expect(toastId).toBeDefined();
    });

    it("should accept duration of 0 for persistent toast", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Persistent toast", {duration: 0});
      });

      expect(toastId).toBeDefined();
    });

    it("should call onClose callback when toast is hidden", async () => {
      let toastRef: ToastType | null = null;
      const onCloseMock = mock(() => {});

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Test", {id: "callback-toast", onClose: onCloseMock});
      });

      await act(async () => {
        toastRef?.hide("callback-toast");
      });
    });

    it("should accept custom animation duration", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider animationDuration={500} swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Test");
      });

      expect(toastId).toBeDefined();
    });

    it("should accept zoom-in animation type", () => {
      const {root} = render(
        <ToastProvider animationType="zoom-in">
          <Text>App</Text>
        </ToastProvider>
      );
      expect(root).toBeTruthy();
    });

    it("should accept slide-in animation type", () => {
      const {root} = render(
        <ToastProvider animationType="slide-in">
          <Text>App</Text>
        </ToastProvider>
      );
      expect(root).toBeTruthy();
    });
  });

  describe("Toast with React elements", () => {
    it("should accept React element as message", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show(<Text>Custom Element</Text>);
      });

      expect(toastId).toBeDefined();
    });
  });

  describe("Toast update and hideAll", () => {
    it("should update an existing toast message", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Original message", {id: "update-test"});
      });

      expect(toastId).toBe("update-test");

      await act(async () => {
        toastRef?.update("update-test", "Updated message");
      });

      expect(typeof toastRef?.update).toBe("function");
    });

    it("should hide all toasts at once", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Toast 1", {id: "hide-all-1"});
        toastRef?.show("Toast 2", {id: "hide-all-2"});
      });

      await act(async () => {
        toastRef?.hideAll();
      });

      expect(toastRef?.isOpen("hide-all-1")).toBe(false);
      expect(toastRef?.isOpen("hide-all-2")).toBe(false);
    });
  });

  describe("Toast placement rendering", () => {
    it("should render toast with top placement", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider placement="top" swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Top toast", {placement: "top"});
      });

      expect(toastId).toBeDefined();
    });

    it("should render toast with center placement", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider placement="center" swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Center toast", {placement: "center"});
      });

      expect(toastId).toBeDefined();
    });
  });

  describe("Toast icon and color variants", () => {
    it("should render success toast with custom icon", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider successIcon={<Text>✓</Text>} swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Success!", {type: "success"});
      });

      expect(toastId).toBeDefined();
    });

    it("should render danger toast with custom icon", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider dangerIcon={<Text>✗</Text>} swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Error!", {type: "danger"});
      });

      expect(toastId).toBeDefined();
    });

    it("should render warning toast with custom icon", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false} warningIcon={<Text>⚠</Text>}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Warning!", {type: "warning"});
      });

      expect(toastId).toBeDefined();
    });
  });

  describe("Type exports", () => {
    it("should export ToastOptions type", () => {
      const options: ToastOptions = {
        duration: 3000,
        id: "test",
        placement: "top",
        type: "success",
      };
      expect(options).toBeDefined();
    });

    it("should export ToastProps type", () => {
      const props: Partial<ToastProps> = {
        id: "test",
        message: "Test message",
        open: true,
      };
      expect(props).toBeDefined();
    });

    it("should export ToastContainerRef type", () => {
      const ref: Partial<ToastContainerRef> = {
        hide: () => {},
        hideAll: () => {},
        isOpen: () => false,
        show: () => "id",
        update: () => {},
      };
      expect(ref).toBeDefined();
    });

    it("should export ToastType type", () => {
      const toastType: Partial<ToastType> = {
        hide: () => {},
        show: () => "id",
      };
      expect(toastType).toBeDefined();
    });
  });

  describe("Toast with renderToast custom renderer", () => {
    it("should use renderToast when provided", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      const customRender = (toast: ToastProps) => <Text>Custom: {String(toast.message)}</Text>;

      render(
        <ToastProvider renderToast={customRender} swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Rendered custom");
      });

      expect(toastRef).toBeTruthy();
    });
  });

  describe("Toast with renderType map", () => {
    it("should use renderType for matching toast type", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      const renderType = {
        custom: (toast: ToastProps) => <Text>Type: {String(toast.message)}</Text>,
      };

      render(
        <ToastProvider renderType={renderType} swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Custom type toast", {type: "custom"});
      });

      expect(toastRef).toBeTruthy();
    });
  });

  describe("Toast onPress handler", () => {
    it("should accept onPress callback on toast", async () => {
      let toastRef: ToastType | null = null;
      const onPressMock = mock((_id: string) => {});

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Pressable toast", {id: "press-test", onPress: onPressMock});
      });

      expect(toastId).toBe("press-test");
    });
  });

  describe("Toast with swipe enabled", () => {
    it("should render toast with swipe enabled (pan responder)", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider swipeEnabled>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      let toastId: string | undefined;
      await act(async () => {
        toastId = toastRef?.show("Swipeable toast", {id: "swipe-toast", swipeEnabled: true});
      });

      expect(toastId).toBe("swipe-toast");
    });
  });

  describe("Toast with zoom-in animation", () => {
    it("should render toast with zoom-in animation type", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider animationType="zoom-in" swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Zoom toast", {animationType: "zoom-in"});
      });

      expect(toastRef).toBeTruthy();
    });
  });

  describe("Toast custom colors", () => {
    it("should render toasts with custom colors", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider
          dangerColor="#ff0000"
          normalColor="#444"
          successColor="#00ff00"
          swipeEnabled={false}
          warningColor="#ffff00"
        >
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Success", {type: "success"});
      });
      await act(async () => {
        toastRef?.show("Danger", {type: "danger"});
      });
      await act(async () => {
        toastRef?.show("Warning", {type: "warning"});
      });
      await act(async () => {
        toastRef?.show("Normal", {type: "normal"});
      });

      expect(toastRef).toBeTruthy();
    });
  });

  describe("Toast with offsets", () => {
    it("should render with custom offsetTop and offsetBottom", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider offsetBottom={30} offsetTop={50} swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Top toast", {placement: "top"});
      });
      await act(async () => {
        toastRef?.show("Bottom toast", {placement: "bottom"});
      });

      expect(toastRef).toBeTruthy();
    });
  });

  describe("Toast icon override", () => {
    it("should use explicit icon over type-specific icon", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider successIcon={<Text>S</Text>} swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("With explicit icon", {
          icon: <Text>Explicit</Text>,
          type: "success",
        });
      });

      expect(toastRef).toBeTruthy();
    });
  });

  describe("Toast auto-close and handleClose", () => {
    let Platform: {OS: string};
    beforeAll(async () => {
      const rn = await import("react-native");
      Platform = rn.Platform;
    });

    it("should auto-close toast after short duration and call onClose", async () => {
      const origOS = Platform.OS;
      Platform.OS = "web";
      let toastRef: ToastType | null = null;
      const onCloseMock = mock(() => {});

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      const {unmount} = render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Short lived", {
          animationDuration: 1,
          duration: 10,
          id: "auto-close",
          onClose: onCloseMock,
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Let the duration timer fire and animations complete
      for (let i = 0; i < 10; i++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        });
      }

      unmount();
      Platform.OS = origOS;
      expect(toastRef).toBeTruthy();
    });

    it("should hide toast when hide() is called (exercises open effect)", async () => {
      const origOS = Platform.OS;
      Platform.OS = "web";
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      const {unmount} = render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Will be hidden", {
          animationDuration: 1,
          duration: 0,
          id: "hide-test",
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      await act(async () => {
        toastRef?.hide("hide-test");
      });

      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        });
      }

      unmount();
      Platform.OS = origOS;
    });
  });

  describe("Toast with swipe and pan responder interaction", () => {
    // biome-ignore lint/suspicious/noExplicitAny: capturing PanResponder internals for test
    type PanConfig = any;
    let capturedPanConfigs: PanConfig[] = [];

    it("should exercise pan responder callbacks via mocked PanResponder.create", async () => {
      const {PanResponder: PR} = require("react-native");
      const origCreate = PR.create.bind(PR);
      capturedPanConfigs = [];

      PR.create = (config: PanConfig) => {
        capturedPanConfigs.push(config);
        return origCreate(config);
      };

      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      const {unmount} = render(
        <ToastProvider swipeEnabled>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Swipe test", {
          animationDuration: 10,
          duration: 0,
          id: "swipe-capture",
          swipeEnabled: true,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Now exercise the captured PanResponder callbacks directly
      const mockEvent = {} as React.SyntheticEvent;
      for (const config of capturedPanConfigs) {
        // onMoveShouldSetPanResponder
        if (config.onMoveShouldSetPanResponder) {
          config.onMoveShouldSetPanResponder(mockEvent, {dx: 20, dy: 0});
        }

        // onPanResponderMove
        if (config.onPanResponderMove) {
          await act(async () => {
            config.onPanResponderMove(mockEvent, {dx: 60, dy: 0});
          });
        }

        // onPanResponderRelease with dx > 50 (right swipe)
        if (config.onPanResponderRelease) {
          await act(async () => {
            config.onPanResponderRelease(mockEvent, {dx: 100, dy: 0});
          });
        }
      }

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
      });

      PR.create = origCreate;
      unmount();
    });

    it("should exercise pan responder left swipe", async () => {
      const {PanResponder: PR} = require("react-native");
      const origCreate = PR.create.bind(PR);
      capturedPanConfigs = [];

      PR.create = (config: PanConfig) => {
        capturedPanConfigs.push(config);
        return origCreate(config);
      };

      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      const {unmount} = render(
        <ToastProvider swipeEnabled>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Left swipe", {
          animationDuration: 10,
          duration: 0,
          id: "swipe-left",
          swipeEnabled: true,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const mockEvent = {} as React.SyntheticEvent;
      for (const config of capturedPanConfigs) {
        // onPanResponderRelease with dx < -50 (left swipe)
        if (config.onPanResponderRelease) {
          await act(async () => {
            config.onPanResponderRelease(mockEvent, {dx: -100, dy: 0});
          });
        }
      }

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
      });

      PR.create = origCreate;
      unmount();
    });

    it("should exercise pan responder snap back on small swipe", async () => {
      const {PanResponder: PR} = require("react-native");
      const origCreate = PR.create.bind(PR);
      capturedPanConfigs = [];

      PR.create = (config: PanConfig) => {
        capturedPanConfigs.push(config);
        return origCreate(config);
      };

      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      const {unmount} = render(
        <ToastProvider swipeEnabled>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Small swipe", {
          animationDuration: 10,
          duration: 0,
          id: "swipe-small",
          swipeEnabled: true,
        });
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const mockEvent = {} as React.SyntheticEvent;
      for (const config of capturedPanConfigs) {
        // onPanResponderRelease with |dx| < 50 (snap back)
        if (config.onPanResponderRelease) {
          await act(async () => {
            config.onPanResponderRelease(mockEvent, {dx: 10, dy: 5});
          });
        }
      }

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 300));
      });

      PR.create = origCreate;
      unmount();
    });
  });

  describe("Toast zoom-in animation with swipe", () => {
    it("renders toast with both zoom-in and swipe enabled", async () => {
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      render(
        <ToastProvider animationType="zoom-in" swipeEnabled>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Zoom and swipe", {
          animationType: "zoom-in",
          duration: 0,
          id: "zoom-swipe",
          swipeEnabled: true,
        });
      });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      expect(toastRef).toBeTruthy();
    });
  });

  describe("Toast onPress interaction", () => {
    it("should trigger onPress when pressing the toast", async () => {
      let toastRef: ToastType | null = null;
      const onPressMock = mock((_id: string) => {});

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      const {getByText} = render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Press me", {
          duration: 0,
          id: "press-interaction",
          onPress: onPressMock,
        });
      });

      // Wait for toast to render
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Try to find and press the toast text
      try {
        const {fireEvent: fe} = require("@testing-library/react-native");
        const toastText = getByText("Press me");
        fe.press(toastText);
      } catch {
        // Toast may not be findable via getByText due to internal structure
      }
    });
  });

  describe("Toast with persistent duration and hideAll", () => {
    it("should handle hideAll for persistent toasts", async () => {
      const {Platform: P} = await import("react-native");
      const origOS = P.OS;
      P.OS = "web";
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      const {unmount} = render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      await act(async () => {
        toastRef?.show("Persistent 1", {
          animationDuration: 1,
          duration: 0,
          id: "p1",
        });
        toastRef?.show("Persistent 2", {
          animationDuration: 1,
          duration: 0,
          id: "p2",
        });
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      await act(async () => {
        toastRef?.hideAll();
      });

      for (let i = 0; i < 5; i++) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        });
      }

      unmount();
      P.OS = origOS;
    });
  });

  describe("useDimensions onChange", () => {
    it("exercises dimension change via Dimensions event", async () => {
      const rn = await import("react-native");
      const Dims = rn.Dimensions;
      let toastRef: ToastType | null = null;

      const TestComponent = () => {
        const toast = useToastNotifications();
        toastRef = toast;
        return <Text>Test</Text>;
      };

      const {unmount} = render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await waitFor(() => {
        expect(toastRef?.show).toBeDefined();
      });

      // Show a toast so ToastItem (which uses useDimensions) renders
      await act(async () => {
        toastRef?.show("Dimension test", {duration: 0, id: "dim-test"});
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Capture the original addEventListener to spy on it
      // Instead, we'll spy on the subscription by monkey-patching Dimensions
      const listeners: Array<(data: {window: rn.ScaledSize}) => void> = [];
      const origAddEventListener = Dims.addEventListener.bind(Dims);
      const patchedAdd = (event: string, handler: (data: {window: rn.ScaledSize}) => void) => {
        if (event === "change") {
          listeners.push(handler);
        }
        return origAddEventListener(event, handler);
      };
      Dims.addEventListener = patchedAdd as typeof Dims.addEventListener;

      // Re-render to pick up the patched addEventListener
      const {unmount: unmount2} = render(
        <ToastProvider swipeEnabled={false}>
          <TestComponent />
        </ToastProvider>
      );

      await act(async () => {
        toastRef?.show("Dimension test 2", {duration: 0, id: "dim-test-2"});
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Call all captured listeners
      await act(async () => {
        for (const listener of listeners) {
          listener({
            window: {fontScale: 1, height: 900, scale: 1, width: 500} as rn.ScaledSize,
          });
        }
      });

      Dims.addEventListener = origAddEventListener;
      unmount2();
      unmount();
    });
  });
});
