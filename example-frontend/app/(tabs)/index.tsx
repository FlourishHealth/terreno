import {SyncDbProvider} from "@terreno/syncdb/react";
import {Box} from "@terreno/ui";
import type React from "react";
import SyncTodosScreen from "@/components/SyncTodosScreen";
import {syncDb} from "@/store/syncdb";

const TodosScreen: React.FC = () => {
  return (
    <SyncDbProvider client={syncDb}>
      <Box flex="grow">
        <SyncTodosScreen />
      </Box>
    </SyncDbProvider>
  );
};

export default TodosScreen;
