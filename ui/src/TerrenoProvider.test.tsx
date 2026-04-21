import {beforeAll, describe, expect, it, mock} from "bun:test";
import {act, render} from "@testing-library/react-native";
import {Text, View} from "react-native";

import {TerrenoProvider} from "./TerrenoProvider";
import {useToast} from "./Toast";

interface RafGlobal {
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (id: number) => void;
}

beforeAll(() => {
  const g = globalThis as RafGlobal;
  if (!g.requestAnimationFrame) {
    g.requestAnimationFrame = (callback) =>
      setTimeout(() => callback(Date.now()), 0) as unknown as number;
    g.cancelAnimationFrame = (id) => clearTimeout(id);
  }
});

describe("TerrenoProvider", () => {
  it("renders children correctly", () => {
    const {getByText} = render(
      <TerrenoProvider>
        <Text>Child content</Text>
      </TerrenoProvider>
    );
    expect(getByText("Child content")).toBeTruthy();
  });

  it("renders correctly with default props", () => {
    const {toJSON} = render(
      <TerrenoProvider>
        <View>
          <Text>App content</Text>
        </View>
      </TerrenoProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders with openAPISpecUrl", () => {
    const {toJSON} = render(
      <TerrenoProvider openAPISpecUrl="https://api.example.com/openapi.json">
        <Text>Content</Text>
      </TerrenoProvider>
    );
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders a toast via the configured renderToast prop", async () => {
    const dismissSpy = mock(() => {});
    let toastApi: ReturnType<typeof useToast> | null = null;

    const ToastCaller = () => {
      toastApi = useToast();
      return <Text>App</Text>;
    };

    const {queryByText} = render(
      <TerrenoProvider>
        <ToastCaller />
      </TerrenoProvider>
    );

    expect(toastApi).not.toBeNull();

    await act(async () => {
      toastApi?.info("Hello from toast", {onDismiss: dismissSpy});
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(queryByText("Hello from toast")).toBeTruthy();
  });
});
