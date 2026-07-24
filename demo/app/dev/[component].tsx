import {ErrorBoundary} from "@components/ErrorBoundary";
import {DemoConfig} from "@config";
import {Box} from "@terreno/ui";
import {router, useLocalSearchParams, useNavigation} from "expo-router";
import {type FC, useEffect} from "react";

export const generateStaticParams = () => DemoConfig.map((c) => ({component: c.name}));

const DevComponentPage: FC = () => {
  const {component, story} = useLocalSearchParams<{component: string; story?: string}>();

  const config = DemoConfig.find((c) => c.name === component);

  const navigation = useNavigation();
  // Set the title
  useEffect(() => {
    navigation.setOptions({title: story});
  }, [navigation, story]);

  if (!story || !config) {
    router.replace("/dev");
  }

  return (
    <Box flex="grow" height="100%" width="100%">
      <ErrorBoundary>{config!.stories[story!]?.render()}</ErrorBoundary>
    </Box>
  );
};

export default DevComponentPage;
