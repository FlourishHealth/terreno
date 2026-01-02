import {Box, Heading, Page, Text} from "ferns-ui";
import type React from "react";

const TabTwoScreen: React.FC = () => {
	return (
		<Page>
			<Box style={{alignItems: "center", flex: 1, justifyContent: "center", padding: 20}}>
				<Heading level={1}>Tab Two</Heading>
				<Box style={{backgroundColor: "#e0e0e0", height: 1, marginVertical: 30, width: "80%"}} />
				<Text style={{textAlign: "center"}}>Explore your second tab with ferns-ui components!</Text>
			</Box>
		</Page>
	);
};

export default TabTwoScreen;
