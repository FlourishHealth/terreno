import {describe, expect, it, mock} from "bun:test";
import {render} from "@testing-library/react-native";
import {useEffect} from "react";
import {Text} from "react-native";

import {renderWithTheme} from "../test-utils";
import {TableContextProvider, useTableContext} from "./tableContext";

describe("tableContext", () => {
  it("exposes default values from useTableContext when no provider is present", () => {
    let ctx: any;
    const Consumer = () => {
      ctx = useTableContext();
      return <Text>ok</Text>;
    };
    renderWithTheme(<Consumer />);
    expect(ctx).toBeTruthy();
    expect(ctx.columns).toEqual([]);
    expect(ctx.stickyHeader).toBe(true);
    expect(ctx.alternateRowBackground).toBe(true);
    expect(ctx.borderStyle).toBe("sm");
    expect(ctx.hasDrawerContents).toBe(false);
    expect(typeof ctx.setSortColumn).toBe("function");
    // Invoke default setSortColumn to cover the no-op default
    expect(() => ctx.setSortColumn({column: 0, direction: "asc"})).not.toThrow();
  });

  it("passes provided values through the provider", () => {
    const setSortColumn = mock(() => {});
    let ctx: any;
    const Consumer = () => {
      ctx = useTableContext();
      return <Text>ok</Text>;
    };
    render(
      <TableContextProvider
        alternateRowBackground={false}
        borderStyle="lg"
        columns={[100, 200]}
        hasDrawerContents
        page={3}
        setSortColumn={setSortColumn}
        sortColumn={{column: 1, direction: "desc"}}
        stickyHeader={false}
      >
        <Consumer />
      </TableContextProvider>
    );
    expect(ctx.columns).toEqual([100, 200]);
    expect(ctx.hasDrawerContents).toBe(true);
    expect(ctx.stickyHeader).toBe(false);
    expect(ctx.alternateRowBackground).toBe(false);
    expect(ctx.borderStyle).toBe("lg");
    expect(ctx.sortColumn).toEqual({column: 1, direction: "desc"});
    ctx.setSortColumn({column: 0, direction: "asc"});
    expect(setSortColumn).toHaveBeenCalled();
  });

  it("useEffect-based consumer can call setSortColumn without errors", () => {
    const setSortColumn = mock(() => {});
    const Consumer = () => {
      const {setSortColumn: setter} = useTableContext();
      useEffect(() => {
        setter({column: 2, direction: "desc"});
      }, [setter]);
      return <Text>ok</Text>;
    };
    render(
      <TableContextProvider
        alternateRowBackground
        borderStyle="sm"
        columns={[100]}
        hasDrawerContents={false}
        page={1}
        setSortColumn={setSortColumn}
        sortColumn={undefined}
        stickyHeader
      >
        <Consumer />
      </TableContextProvider>
    );
    expect(setSortColumn).toHaveBeenCalledWith({column: 2, direction: "desc"});
  });
});
