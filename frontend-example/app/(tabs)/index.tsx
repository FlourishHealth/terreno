import {Box, Button, Heading, Page, Text} from "@terreno/ui";
import type React from "react";
import {useCallback} from "react";
import {logout, useAppDispatch} from "@/store";

const TabOneScreen: React.FC = () => {
  const dispatch = useAppDispatch();

  const handleLogout = useCallback(() => {
    dispatch(logout());
  }, [dispatch]);

  return (
    <Page>
      <Box style={{alignItems: "center", flex: 1, justifyContent: "center", padding: 20}}>
        <Heading level={1}>Tab One</Heading>
        <Box style={{backgroundColor: "#e0e0e0", height: 1, marginVertical: 30, width: "80%"}} />
        <Text style={{textAlign: "center"}}>Welcome to your Terreno app!</Text>
        <Button onPress={handleLogout} style={{marginTop: 30}}>
          Logout
        </Button>
      </Box>
    </Page>
  );
};

export default TabOneScreen;
