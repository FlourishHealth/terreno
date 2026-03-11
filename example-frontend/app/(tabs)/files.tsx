import {DocumentStorageBrowser} from "@terreno/admin-frontend";
import {router} from "expo-router";
import type React from "react";
import {useCallback} from "react";

import {terrenoApi} from "@/store/sdk";

const FilesScreen: React.FC = () => {
  const handleSettingsPress = useCallback(() => {
    router.push("/gcs-settings");
  }, []);

  return (
    <DocumentStorageBrowser
      api={terrenoApi}
      basePath="/admin/documents"
      onSettingsPress={handleSettingsPress}
      title="Files"
    />
  );
};

export default FilesScreen;
