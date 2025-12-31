import type React from "react";
import {type Context, createContext, useContext} from "react";

import type {TableContextProviderProps, TableContextType} from "../Common";

const TableContext: Context<TableContextType> = createContext<TableContextType>({
  alternateRowBackground: true,
  borderStyle: "sm",
  columns: [],
  hasDrawerContents: false,
  page: 1,
  setSortColumn: () => {},
  sortColumn: undefined,
  stickyHeader: true,
});

export const {Provider} = TableContext;

export const TableContextProvider = ({
  children,
  columns,
  hasDrawerContents,
  sortColumn,
  setSortColumn,
  stickyHeader,
  borderStyle,
  alternateRowBackground,
  page,
}: TableContextProviderProps): React.ReactElement<typeof Provider> => {
  return (
    <Provider
      value={{
        alternateRowBackground,
        borderStyle,
        columns,
        hasDrawerContents,
        page,
        setSortColumn,
        sortColumn,
        stickyHeader,
      }}
    >
      {children}
    </Provider>
  );
};

export function useTableContext(): TableContextType {
  const {
    columns,
    hasDrawerContents,
    setSortColumn,
    sortColumn,
    stickyHeader,
    alternateRowBackground,
    borderStyle,
  } = useContext(TableContext);
  return {
    alternateRowBackground,
    borderStyle,
    columns,
    hasDrawerContents,
    setSortColumn,
    sortColumn,
    stickyHeader,
  };
}
