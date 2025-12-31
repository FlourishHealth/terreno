import {Box, type TableNumberProps, TableText} from "ferns-ui";

export const TableNumberDemo = (props?: Partial<TableNumberProps>) => {
  return (
    <Box alignItems="center" justifyContent="center">
      <TableText value="$1.97" {...props} />
    </Box>
  );
};
