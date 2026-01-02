import {StatusBar} from "expo-status-bar";
import {Box, Heading, Page, Text} from "@terreno/ui";
import type React from "react";
import {Platform} from "react-native";

const ModalScreen: React.FC = () => {
  return (
    <Page>
      <Box style={{alignItems: "center", flex: 1, justifyContent: "center", padding: 20}}>
        <Heading level={1}>Modal</Heading>
        <Box style={{backgroundColor: "#e0e0e0", height: 1, marginVertical: 30, width: "80%"}} />
        <Text style={{textAlign: "center"}}>This is a modal screen!</Text>

        {/* Use a light status bar on iOS to account for the black space above the modal */}
        <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
      </Box>
    </Page>
  );
};

export default ModalScreen;
