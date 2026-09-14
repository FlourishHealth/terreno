import {describe, expect, it} from "bun:test";
import {act} from "@testing-library/react-native";

import {DataTableHeaderInfoMarkdown} from "./DataTableHeaderInfoMarkdown";
import {renderWithTheme} from "./test-utils";

describe("DataTableHeaderInfoMarkdown", () => {
  it("renders markdown children after lazy markdown display loads", async () => {
    const {findByText} = renderWithTheme(
      <DataTableHeaderInfoMarkdown>**Column info**</DataTableHeaderInfoMarkdown>
    );

    await act(async () => {
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    });

    expect(await findByText("Column info")).toBeTruthy();
  });
});
