import {SyncDbProvider} from "@terreno/syncdb/react";
import type React from "react";
import SyncTodosScreen from "@/components/SyncTodosScreen";
import {syncDb} from "@/store/syncdb";

const TodosScreen: React.FC = () => {
  return (
    <SyncDbProvider client={syncDb}>
      <SyncTodosScreen />
    </SyncDbProvider>
  );
};

export default TodosScreen;
