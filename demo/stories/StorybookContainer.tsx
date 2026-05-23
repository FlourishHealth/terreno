import {Box} from "@terreno/ui";
import React from "react";

export class StorybookContainer extends React.Component<{children?: React.ReactNode}> {
  render() {
    return (
      <Box direction="column" display="flex" height="100%" padding={4} width="100%">
        {this.props.children}
      </Box>
    );
  }
}
