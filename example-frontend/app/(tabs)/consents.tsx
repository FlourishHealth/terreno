import {ConsentHistory, Page} from "@terreno/ui";
import type React from "react";
import {terrenoApi} from "@/store/sdk";

const ConsentsScreen: React.FC = () => {
  return (
    <Page title="My Consents">
      <ConsentHistory api={terrenoApi} />
    </Page>
  );
};

export default ConsentsScreen;
