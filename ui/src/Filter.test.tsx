import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import type {FilterDefinition, FilterValues} from "./Common";
import {Filter} from "./Filter";
import {renderWithTheme} from "./test-utils";

const filters: FilterDefinition[] = [
  {field: "completed", kind: "boolean", label: "Completed"},
  {
    field: "status",
    kind: "choice",
    label: "Status",
    options: [
      {label: "Open", value: "open"},
      {label: "Closed", value: "closed"},
    ],
  },
  {
    field: "tags",
    kind: "multiChoice",
    label: "Tags",
    options: [
      {label: "Urgent", value: "urgent"},
      {label: "Follow up", value: "followUp"},
    ],
  },
  {field: "title", kind: "text", label: "Title"},
];

/** Flatten every style object in a rendered tree so layout regressions can be asserted. */
const collectStyles = (node: unknown): Record<string, unknown>[] => {
  if (!node || typeof node !== "object") {
    return [];
  }
  if (Array.isArray(node)) {
    return node.flatMap(collectStyles);
  }
  const element = node as {children?: unknown; props?: {style?: unknown}};
  const style = element.props?.style;
  const own = Array.isArray(style) ? style : [style];
  return [
    ...own.filter((entry): entry is Record<string, unknown> => Boolean(entry)),
    ...collectStyles(element.children),
  ];
};

describe("Filter", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<Filter filters={filters} onChange={() => {}} values={{}} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders a control for every filter", () => {
    const {getByTestId} = renderWithTheme(
      <Filter filters={filters} onChange={() => {}} testID="f" values={{}} />
    );
    // SelectField and MultiselectField expose their base test id on the label; TextField
    // puts it on the input.
    expect(getByTestId("f.filter.completed.label")).toBeTruthy();
    expect(getByTestId("f.filter.status.label")).toBeTruthy();
    expect(getByTestId("f.filter.tags")).toBeTruthy();
    expect(getByTestId("f.filter.title")).toBeTruthy();
  });

  it("renders the title heading", () => {
    const {getByText} = renderWithTheme(
      <Filter filters={filters} onChange={() => {}} title="Refine" values={{}} />
    );
    expect(getByText("Refine")).toBeTruthy();
  });

  it("emits the full value record when a text filter changes", () => {
    const onChange = mock((_values: FilterValues) => {});
    const {getByTestId} = renderWithTheme(
      <Filter filters={filters} onChange={onChange} testID="f" values={{status: "open"}} />
    );

    fireEvent.changeText(getByTestId("f.filter.title"), "milk");
    expect(onChange).toHaveBeenCalledWith({status: "open", title: "milk"});
  });

  it("emits an array when a multiChoice option is selected", () => {
    const onChange = mock((_values: FilterValues) => {});
    const {getByLabelText} = renderWithTheme(
      <Filter filters={filters} onChange={onChange} testID="f" values={{tags: []}} />
    );

    fireEvent.press(getByLabelText("Urgent"));
    expect(onChange).toHaveBeenCalledWith({tags: ["urgent"]});
  });

  describe("active filters", () => {
    it("renders no chips when nothing is applied", () => {
      const {queryByTestId} = renderWithTheme(
        <Filter filters={filters} onChange={() => {}} testID="f" values={{}} />
      );
      expect(queryByTestId("f.activeFilters")).toBeNull();
      expect(queryByTestId("f.count")).toBeNull();
    });

    it("renders one chip per applied filter and a count badge", () => {
      const {getByTestId, getByText} = renderWithTheme(
        <Filter
          filters={filters}
          onChange={() => {}}
          testID="f"
          values={{completed: true, status: "open", tags: ["urgent", "followUp"]}}
        />
      );
      expect(getByTestId("f.chip.completed")).toBeTruthy();
      expect(getByTestId("f.chip.status")).toBeTruthy();
      expect(getByTestId("f.chip.tags.urgent")).toBeTruthy();
      expect(getByTestId("f.chip.tags.followUp")).toBeTruthy();
      expect(getByText("4")).toBeTruthy();
    });

    it("clears just that filter when a chip is dismissed", () => {
      const onChange = mock((_values: FilterValues) => {});
      const {getByTestId} = renderWithTheme(
        <Filter
          filters={filters}
          onChange={onChange}
          testID="f"
          values={{completed: true, status: "open"}}
        />
      );

      fireEvent.press(getByTestId("f.chip.status.dismiss"));
      expect(onChange).toHaveBeenCalledWith({completed: true, status: ""});
    });

    it("removes only the dismissed option from a multiChoice filter", () => {
      const onChange = mock((_values: FilterValues) => {});
      const {getByTestId} = renderWithTheme(
        <Filter
          filters={filters}
          onChange={onChange}
          testID="f"
          values={{tags: ["urgent", "followUp"]}}
        />
      );

      fireEvent.press(getByTestId("f.chip.tags.urgent.dismiss"));
      expect(onChange).toHaveBeenCalledWith({tags: ["followUp"]});
    });

    it("gives sibling multiChoice chips distinct accessible dismiss names", () => {
      const {getByLabelText} = renderWithTheme(
        <Filter
          filters={filters}
          onChange={() => {}}
          testID="f"
          values={{tags: ["urgent", "followUp"]}}
        />
      );
      expect(getByLabelText("Remove Tags filter: Urgent")).toBeTruthy();
      expect(getByLabelText("Remove Tags filter: Follow up")).toBeTruthy();
    });

    it("hides the chip row when showActiveFilters is false", () => {
      const {queryByTestId} = renderWithTheme(
        <Filter
          filters={filters}
          onChange={() => {}}
          showActiveFilters={false}
          testID="f"
          values={{status: "open"}}
        />
      );
      expect(queryByTestId("f.activeFilters")).toBeNull();
    });
  });

  describe("clear all", () => {
    it("only appears once a filter is applied", () => {
      const {queryByTestId, rerender} = renderWithTheme(
        <Filter filters={filters} onChange={() => {}} testID="f" values={{}} />
      );
      expect(queryByTestId("f.clearAll")).toBeNull();

      rerender(
        <Filter filters={filters} onChange={() => {}} testID="f" values={{status: "open"}} />
      );
      expect(queryByTestId("f.clearAll")).not.toBeNull();
    });

    it("resets every filter it owns and leaves other keys alone", () => {
      const onChange = mock((_values: FilterValues) => {});
      const {getByTestId} = renderWithTheme(
        <Filter
          filters={filters}
          onChange={onChange}
          testID="f"
          values={{completed: false, page: "3", status: "open", tags: ["urgent"], title: "milk"}}
        />
      );

      fireEvent.press(getByTestId("f.clearAll"));
      expect(onChange).toHaveBeenCalledWith({
        completed: undefined,
        page: "3",
        status: "",
        tags: [],
        title: "",
      });
    });

    it("defers to onClear when provided", () => {
      const onChange = mock((_values: FilterValues) => {});
      const onClear = mock(() => {});
      const {getByTestId} = renderWithTheme(
        <Filter
          filters={filters}
          onChange={onChange}
          onClear={onClear}
          testID="f"
          values={{status: "open"}}
        />
      );

      fireEvent.press(getByTestId("f.clearAll"));
      expect(onClear).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled();
    });

    it("can be hidden entirely", () => {
      const {queryByTestId} = renderWithTheme(
        <Filter
          filters={filters}
          onChange={() => {}}
          showClearAll={false}
          testID="f"
          values={{status: "open"}}
        />
      );
      expect(queryByTestId("f.clearAll")).toBeNull();
    });

    // Search has no chip, so keying the action off chips alone left a searching user with no
    // way to reset.
    it("appears when search is the only active constraint", () => {
      const {queryByTestId} = renderWithTheme(
        <Filter
          filters={filters}
          onChange={() => {}}
          onSearchChange={() => {}}
          searchValue="milk"
          testID="f"
          values={{}}
        />
      );
      expect(queryByTestId("f.clearAll")).not.toBeNull();
    });

    it("stays hidden for a blank search", () => {
      const {queryByTestId} = renderWithTheme(
        <Filter
          filters={filters}
          onChange={() => {}}
          onSearchChange={() => {}}
          searchValue="   "
          testID="f"
          values={{}}
        />
      );
      expect(queryByTestId("f.clearAll")).toBeNull();
    });

    it("resets the search input alongside the filters", () => {
      const onChange = mock((_values: FilterValues) => {});
      const onSearchChange = mock((_value: string) => {});
      const {getByTestId} = renderWithTheme(
        <Filter
          filters={filters}
          onChange={onChange}
          onSearchChange={onSearchChange}
          searchValue="milk"
          testID="f"
          values={{status: "open"}}
        />
      );

      fireEvent.press(getByTestId("f.clearAll"));
      expect(onSearchChange).toHaveBeenCalledWith("");
      expect(onChange).toHaveBeenCalledWith({
        completed: undefined,
        status: "",
        tags: [],
        title: "",
      });
    });
  });

  describe("search", () => {
    it("is hidden until onSearchChange is provided", () => {
      const {queryByTestId} = renderWithTheme(
        <Filter filters={filters} onChange={() => {}} testID="f" values={{}} />
      );
      expect(queryByTestId("f.search")).toBeNull();
    });

    it("calls onSearchChange as the user types", () => {
      const onSearchChange = mock((_value: string) => {});
      const {getByTestId} = renderWithTheme(
        <Filter
          filters={filters}
          onChange={() => {}}
          onSearchChange={onSearchChange}
          searchValue=""
          testID="f"
          values={{}}
        />
      );

      fireEvent.changeText(getByTestId("f.search"), "milk");
      expect(onSearchChange).toHaveBeenCalledWith("milk");
    });
  });

  describe("collapsible", () => {
    it("has no toggle unless collapsible is set", () => {
      const {queryByTestId} = renderWithTheme(
        <Filter filters={filters} onChange={() => {}} testID="f" values={{}} />
      );
      expect(queryByTestId("f.toggle")).toBeNull();
    });

    it("hides and re-shows the controls", () => {
      const {getByTestId, queryByTestId} = renderWithTheme(
        <Filter collapsible filters={filters} onChange={() => {}} testID="f" values={{}} />
      );
      expect(queryByTestId("f.filter.title")).not.toBeNull();

      fireEvent.press(getByTestId("f.toggle"));
      expect(queryByTestId("f.filter.title")).toBeNull();

      fireEvent.press(getByTestId("f.toggle"));
      expect(queryByTestId("f.filter.title")).not.toBeNull();
    });

    it("starts collapsed when defaultExpanded is false", () => {
      const {queryByTestId} = renderWithTheme(
        <Filter
          collapsible
          defaultExpanded={false}
          filters={filters}
          onChange={() => {}}
          testID="f"
          values={{}}
        />
      );
      expect(queryByTestId("f.filter.title")).toBeNull();
    });

    it("keeps the chips visible while collapsed", () => {
      const {getByTestId, queryByTestId} = renderWithTheme(
        <Filter
          collapsible
          defaultExpanded={false}
          filters={filters}
          onChange={() => {}}
          testID="f"
          values={{status: "open"}}
        />
      );
      expect(queryByTestId("f.filter.title")).toBeNull();
      expect(getByTestId("f.chip.status")).toBeTruthy();
    });
  });

  describe("range filters", () => {
    const rangeFilters: FilterDefinition[] = [
      {field: "created", kind: "dateRange", label: "Created"},
      {field: "score", kind: "numberRange", label: "Score"},
    ];

    it("renders a from and a to control for each range", () => {
      const {getByTestId} = renderWithTheme(
        <Filter filters={rangeFilters} onChange={() => {}} testID="f" values={{}} />
      );
      expect(getByTestId("f.filter.created.from")).toBeTruthy();
      expect(getByTestId("f.filter.created.to")).toBeTruthy();
      expect(getByTestId("f.filter.score.from")).toBeTruthy();
      expect(getByTestId("f.filter.score.to")).toBeTruthy();
    });

    it("writes a number, not a string, for a numberRange bound", () => {
      const onChange = mock((_values: FilterValues) => {});
      const {getByTestId} = renderWithTheme(
        <Filter filters={rangeFilters} onChange={onChange} testID="f" values={{score: {to: 9}}} />
      );

      fireEvent.changeText(getByTestId("f.filter.score.from"), "3");
      expect(onChange).toHaveBeenCalledWith({score: {from: 3, to: 9}});
    });

    it("clears a numberRange bound when its input is emptied", () => {
      const onChange = mock((_values: FilterValues) => {});
      const {getByTestId} = renderWithTheme(
        <Filter
          filters={rangeFilters}
          onChange={onChange}
          testID="f"
          values={{score: {from: 3, to: 9}}}
        />
      );

      fireEvent.changeText(getByTestId("f.filter.score.from"), "");
      expect(onChange).toHaveBeenCalledWith({score: {from: undefined, to: 9}});
    });
  });

  describe("layout", () => {
    // Box maps any `flex` value other than grow/shrink to `flex: 0`, which zeroes the flex
    // basis. In the stacked column that collapsed every control to zero height and stacked
    // the labels on top of each other, so no wrapper may carry it.
    it("never gives a stacked control a zero flex basis", () => {
      const {toJSON} = renderWithTheme(
        <Filter filters={filters} onChange={() => {}} testID="f" values={{}} />
      );
      const styles = collectStyles(toJSON());
      expect(styles.length).toBeGreaterThan(0);
      expect(styles.some((style) => style.flex === 0)).toBe(false);
    });

    it("renders inline without changing behavior", () => {
      const onChange = mock((_values: FilterValues) => {});
      const {getByTestId} = renderWithTheme(
        <Filter filters={filters} layout="inline" onChange={onChange} testID="f" values={{}} />
      );

      fireEvent.changeText(getByTestId("f.filter.title"), "milk");
      expect(onChange).toHaveBeenCalledWith({title: "milk"});
    });
  });
});
