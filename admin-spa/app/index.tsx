import {Box, Text} from "@terreno/ui";
import type React from "react";

const IndexScreen: React.FC = () => {
  return (
    <Box alignItems="center" justifyContent="center" padding={6} testID="admin-spa-hello">
      <Text>Hello admin</Text>
    </Box>
  );
};

export default IndexScreen;
