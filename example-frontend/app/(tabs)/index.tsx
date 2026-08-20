import {SyncDbProvider} from "@terreno/syncdb/react";
import type React from "react";
import {View} from "react-native";
import SyncTodosScreen from "@/components/SyncTodosScreen";
import {syncDb} from "@/store/syncdb";

const TodosScreen: React.FC = () => {
  return (
    <SyncDbProvider client={syncDb}>
      <View style={{flex: 1}}>
        <SyncTodosScreen />
      </View>
    </SyncDbProvider>
  );
};

export default TodosScreen;
