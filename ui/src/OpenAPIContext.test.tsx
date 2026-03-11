import {describe, expect, it} from "bun:test";
import {render} from "@testing-library/react-native";
import {Text} from "react-native";

import {OpenAPIProvider} from "./OpenAPIContext";

describe("OpenAPIContext", () => {
  describe("OpenAPIProvider", () => {
    it("renders children", () => {
      const {getByText} = render(
        <OpenAPIProvider>
          <Text>Child content</Text>
        </OpenAPIProvider>
      );
      expect(getByText("Child content")).toBeTruthy();
    });

    it("renders with specUrl prop", () => {
      const {getByText} = render(
        <OpenAPIProvider specUrl="https://api.example.com/openapi.json">
          <Text>Content with spec URL</Text>
        </OpenAPIProvider>
      );
      expect(getByText("Content with spec URL")).toBeTruthy();
    });

    it("renders correctly with undefined specUrl", () => {
      const {toJSON} = render(
        <OpenAPIProvider specUrl={undefined}>
          <Text>No spec URL</Text>
        </OpenAPIProvider>
      );
      expect(toJSON()).toMatchSnapshot();
    });
  });
});
