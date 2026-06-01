import {TerrenoProvider} from "@terreno/ui";
import {Stack} from "expo-router";
import React from "react";
import {AdminGate} from "../components/AdminGate";
import {AppConfigGate} from "../components/AppConfigGate";
import {StoreProvider} from "../components/StoreProvider";

/**
 * Provider order:
 * - AppConfigGate (outermost): loads app-config.json before anything else, since the
 *   store + auth client are built from it.
 * - StoreProvider: builds the better-auth client + Redux store, mounts <Provider>.
 * - TerrenoProvider: theme/toast context (inside Provider so theme hooks work).
 * - AdminGate (innermost): session + admin authorization, gating the route Stack.
 */
const RootLayout: React.FC = () => {
  return (
    <AppConfigGate>
      <StoreProvider>
        <TerrenoProvider>
          <AdminGate>
            <Stack screenOptions={{headerShown: false}} />
          </AdminGate>
        </TerrenoProvider>
      </StoreProvider>
    </AppConfigGate>
  );
};

export default RootLayout;
