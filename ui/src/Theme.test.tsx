import {describe, expect, it} from "bun:test";
import {act, render} from "@testing-library/react-native";
import {Text, View} from "react-native";

import {ThemeProvider, useTheme} from "./Theme";

type ThemeContextValue = ReturnType<typeof useTheme>;
type ThemeValue = ThemeContextValue["theme"];

const ThemeConsumer = () => {
  const {theme} = useTheme();
  return (
    <View>
      <Text testID="surface-base">{theme.surface?.base}</Text>
      <Text testID="text-primary">{theme.text?.primary}</Text>
    </View>
  );
};

describe("Theme", () => {
  describe("ThemeProvider", () => {
    it("renders children", () => {
      const {getByText} = render(
        <ThemeProvider>
          <Text>Child content</Text>
        </ThemeProvider>
      );
      expect(getByText("Child content")).toBeTruthy();
    });

    it("provides default theme values", () => {
      const {getByTestId} = render(
        <ThemeProvider>
          <ThemeConsumer />
        </ThemeProvider>
      );
      // Default surface.base is neutral000 which maps to #FFFFFF
      expect(getByTestId("surface-base").children[0]).toBe("#FFFFFF");
      // Default text.primary is neutral900 which maps to #1C1C1C
      expect(getByTestId("text-primary").children[0]).toBe("#1C1C1C");
    });
  });

  describe("useTheme", () => {
    it("returns theme object", () => {
      let capturedTheme: ThemeContextValue | undefined;
      const Capture = () => {
        capturedTheme = useTheme();
        return null;
      };

      render(
        <ThemeProvider>
          <Capture />
        </ThemeProvider>
      );

      expect(capturedTheme?.theme).toBeDefined();
      expect(capturedTheme?.setTheme).toBeDefined();
      expect(capturedTheme?.setPrimitives).toBeDefined();
      expect(capturedTheme?.resetTheme).toBeDefined();
    });

    it("provides surface colors", () => {
      let theme: ThemeValue | undefined;
      const Capture = () => {
        theme = useTheme().theme;
        return null;
      };

      render(
        <ThemeProvider>
          <Capture />
        </ThemeProvider>
      );

      expect(theme?.surface).toBeDefined();
      expect(theme?.surface?.base).toBeDefined();
      expect(theme?.surface?.primary).toBeDefined();
      expect(theme?.surface?.error).toBeDefined();
    });

    it("provides text colors", () => {
      let theme: ThemeValue | undefined;
      const Capture = () => {
        theme = useTheme().theme;
        return null;
      };

      render(
        <ThemeProvider>
          <Capture />
        </ThemeProvider>
      );

      expect(theme?.text).toBeDefined();
      expect(theme?.text?.primary).toBeDefined();
      expect(theme?.text?.inverted).toBeDefined();
      expect(theme?.text?.error).toBeDefined();
    });

    it("provides border colors", () => {
      let theme: ThemeValue | undefined;
      const Capture = () => {
        theme = useTheme().theme;
        return null;
      };

      render(
        <ThemeProvider>
          <Capture />
        </ThemeProvider>
      );

      expect(theme?.border).toBeDefined();
      expect(theme?.border?.default).toBeDefined();
    });

    it("provides spacing values", () => {
      let theme: ThemeValue | undefined;
      const Capture = () => {
        theme = useTheme().theme;
        return null;
      };

      render(
        <ThemeProvider>
          <Capture />
        </ThemeProvider>
      );

      expect(theme?.spacing).toBeDefined();
      expect(theme?.spacing?.sm).toBeDefined();
      expect(theme?.spacing?.md).toBeDefined();
      expect(theme?.spacing?.lg).toBeDefined();
    });

    it("provides radius values", () => {
      let theme: ThemeValue | undefined;
      const Capture = () => {
        theme = useTheme().theme;
        return null;
      };

      render(
        <ThemeProvider>
          <Capture />
        </ThemeProvider>
      );

      expect(theme?.radius).toBeDefined();
      expect(theme?.radius?.default).toBeDefined();
      expect(theme?.radius?.rounded).toBeDefined();
    });

    it("updates theme when setTheme is called", () => {
      let captured: ThemeContextValue | undefined;
      const Capture = () => {
        captured = useTheme();
        return null;
      };
      render(
        <ThemeProvider>
          <Capture />
        </ThemeProvider>
      );
      act(() => {
        captured?.setTheme({surface: {base: "error100"}});
      });
      expect(captured?.theme.surface.base).toBe("#D33232");
    });

    it("updates primitives when setPrimitives is called", () => {
      let captured: ThemeContextValue | undefined;
      const Capture = () => {
        captured = useTheme();
        return null;
      };
      render(
        <ThemeProvider>
          <Capture />
        </ThemeProvider>
      );
      act(() => {
        captured?.setPrimitives({neutral000: "#AABBCC"});
      });
      expect(captured?.theme.surface.base).toBe("#AABBCC");
    });

    it("resets theme to default when resetTheme is called", () => {
      let captured: ThemeContextValue | undefined;
      const Capture = () => {
        captured = useTheme();
        return null;
      };
      render(
        <ThemeProvider>
          <Capture />
        </ThemeProvider>
      );
      act(() => {
        captured?.setTheme({surface: {base: "error100"}});
        captured?.setPrimitives({neutral000: "#123456"});
      });
      act(() => {
        captured?.resetTheme();
      });
      expect(captured?.theme.surface.base).toBe("#FFFFFF");
    });

    it("supports non-object top-level values when setTheme is called", () => {
      let captured: ThemeContextValue | undefined;
      const Capture = () => {
        captured = useTheme();
        return null;
      };
      render(
        <ThemeProvider>
          <Capture />
        </ThemeProvider>
      );
      act(() => {
        captured?.setTheme({primitives: undefined});
      });
      expect(captured?.theme).toBeDefined();
    });

    it("invokes the no-op default context setters when rendered without a provider", () => {
      let captured: ThemeContextValue | undefined;
      const Capture = () => {
        captured = useTheme();
        return null;
      };
      render(<Capture />);
      // Exercise the default no-op callbacks on the context.
      expect(() => {
        captured?.resetTheme();
        captured?.setPrimitives({neutral000: "#000000"});
        captured?.setTheme({surface: {base: "neutral000"}});
      }).not.toThrow();
    });
  });
});
