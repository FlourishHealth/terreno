import {Box, Heading, TableIconButton, type TableIconButtonProps} from "@terreno/ui";

export const TableIconButtonDemo = (props: Partial<TableIconButtonProps>) => {
  return (
    <Box alignItems="center" justifyContent="center">
      <TableIconButton
        onClick={() => console.info("hello table icon button")}
        tableIconButtonName="edit"
        {...props}
      />
    </Box>
  );
};

export const TableIconButtonStates = () => {
  return (
    <Box direction="row" wrap>
      <Box padding={2}>
        <Box marginBottom={1}>
          <Heading>Edit</Heading>
        </Box>
        <Box alignItems="center">
          <TableIconButton onClick={() => console.info("click edit")} tableIconButtonName="edit" />
        </Box>
      </Box>
      <Box padding={2}>
        <Box marginBottom={1}>
          <Heading>Save and Close</Heading>
        </Box>
        <Box alignItems="center">
          <TableIconButton
            onClick={() => console.info("save and close")}
            tableIconButtonName="saveAndClose"
          />
        </Box>
      </Box>
      <Box padding={2}>
        <Box marginBottom={1}>
          <Heading>Insert</Heading>
        </Box>
        <Box alignItems="center">
          <TableIconButton
            onClick={() => console.info("insert data")}
            tableIconButtonName="insert"
          />
        </Box>
      </Box>
      <Box padding={2}>
        <Box marginBottom={1}>
          <Heading>Drawer Open</Heading>
        </Box>
        <Box alignItems="center">
          <TableIconButton
            onClick={() => console.info("open drawer")}
            tableIconButtonName="drawerOpen"
          />
        </Box>
      </Box>
      <Box padding={2}>
        <Box marginBottom={1}>
          <Heading>Drawer Close</Heading>
        </Box>
        <Box alignItems="center">
          <TableIconButton
            onClick={() => console.info("close drawer")}
            tableIconButtonName="drawerClose"
          />
        </Box>
      </Box>
    </Box>
  );
};
