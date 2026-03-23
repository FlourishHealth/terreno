import {ConfigurationScreen} from "@terreno/admin-frontend";
import React from "react";
import {terrenoApi} from "@/store/sdk";

const ConfigScreen: React.FC = () => {
  return <ConfigurationScreen api={terrenoApi} title="App Configuration" />;
};

export default ConfigScreen;
