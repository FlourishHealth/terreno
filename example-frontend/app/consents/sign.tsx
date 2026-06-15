import {Box, ConsentLinkScreen} from "@terreno/ui";
import {useLocalSearchParams} from "expo-router";
import type React from "react";
import {terrenoApi} from "@/store/sdk";

/**
 * Public route for completing consent forms via a signed link. Reachable
 * without logging in; the token is provided as a `?token=` query parameter.
 */
const ConsentSignScreen: React.FC = () => {
  const {token} = useLocalSearchParams<{token?: string}>();

  return (
    <Box flex="grow">
      <ConsentLinkScreen api={terrenoApi} token={token ?? ""} />
    </Box>
  );
};

export default ConsentSignScreen;
