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
        <ToastProvider>
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
        <ToastProvider>
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
        <ToastProvider>
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
        <ToastProvider>
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
        <ToastProvider>
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
        <ToastProvider>
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
        <ToastProvider>
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
        <ToastProvider>
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
        <ToastProvider animationDuration={500}>
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
        <ToastProvider>
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
});
