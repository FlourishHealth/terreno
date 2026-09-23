import {SyncDbProvider} from "@terreno/syncdb/react";
import {Box} from "@terreno/ui";
import type React from "react";
import {NotificationCenter} from "@/components/NotificationCenter";
import SyncTodosScreen from "@/components/SyncTodosScreen";
import {syncDb} from "@/store/syncdb";

const TodosScreen: React.FC = () => {
  return (
    <SyncDbProvider client={syncDb}>
      <NotificationCenter>
        <Box flex="grow">
          <SyncTodosScreen />
        </Box>
      </NotificationCenter>
    </SyncDbProvider>
  );
};

export default TodosScreen;
