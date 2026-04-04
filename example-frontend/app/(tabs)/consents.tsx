import {ConsentHistory} from "@terreno/admin-frontend";
import type React from "react";
import {terrenoApi} from "@/store/sdk";

const ConsentsScreen: React.FC = () => {
  return <ConsentHistory api={terrenoApi} />;
};

export default ConsentsScreen;
