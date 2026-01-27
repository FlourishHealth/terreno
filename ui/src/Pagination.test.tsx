import {describe, expect, it, mock} from "bun:test";
import {fireEvent} from "@testing-library/react-native";

import {Pagination} from "./Pagination";
import {renderWithTheme} from "./test-utils";

describe("Pagination", () => {
  it("renders correctly with default props", () => {
    const {toJSON} = renderWithTheme(<Pagination page={1} setPage={() => {}} totalPages={5} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders page numbers for small page count", () => {
    const {getByText} = renderWithTheme(<Pagination page={1} setPage={() => {}} totalPages={5} />);
    expect(getByText("1")).toBeTruthy();
    expect(getByText("2")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
    expect(getByText("4")).toBeTruthy();
    expect(getByText("5")).toBeTruthy();
  });

  it("renders with ellipsis for large page count", () => {
    const {toJSON} = renderWithTheme(<Pagination page={5} setPage={() => {}} totalPages={20} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("highlights current page", () => {
    const {toJSON} = renderWithTheme(<Pagination page={3} setPage={() => {}} totalPages={5} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("calls setPage when page number is clicked", () => {
    const handleSetPage = mock((_page: number) => {});
    const {getByText} = renderWithTheme(
      <Pagination page={1} setPage={handleSetPage} totalPages={5} />
    );

    fireEvent.press(getByText("3"));
    expect(handleSetPage).toHaveBeenCalledWith(3);
  });

  it("calls setPage with next page when next button is clicked", () => {
    const handleSetPage = mock((_page: number) => {});
    const {getByHintText} = renderWithTheme(
      <Pagination page={2} setPage={handleSetPage} totalPages={5} />
    );

    fireEvent.press(getByHintText("Click to go to next page"));
    expect(handleSetPage).toHaveBeenCalledWith(3);
  });

  it("calls setPage with previous page when prev button is clicked", () => {
    const handleSetPage = mock((_page: number) => {});
    const {getByHintText} = renderWithTheme(
      <Pagination page={3} setPage={handleSetPage} totalPages={5} />
    );

    fireEvent.press(getByHintText("Click to go to prev page"));
    expect(handleSetPage).toHaveBeenCalledWith(2);
  });

  it("disables prev button on first page", () => {
    const {toJSON} = renderWithTheme(<Pagination page={1} setPage={() => {}} totalPages={5} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("disables next button on last page", () => {
    const {toJSON} = renderWithTheme(<Pagination page={5} setPage={() => {}} totalPages={5} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders correctly with single page", () => {
    const {toJSON} = renderWithTheme(<Pagination page={1} setPage={() => {}} totalPages={1} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders correctly when on last pages", () => {
    const {toJSON} = renderWithTheme(<Pagination page={19} setPage={() => {}} totalPages={20} />);
    expect(toJSON()).toMatchSnapshot();
  });

  it("renders correctly when on first pages", () => {
    const {toJSON} = renderWithTheme(<Pagination page={2} setPage={() => {}} totalPages={20} />);
    expect(toJSON()).toMatchSnapshot();
  });
});
