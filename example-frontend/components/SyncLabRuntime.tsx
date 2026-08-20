/**
 * App-shell Sync Lab runtime: keeps churn engines alive across navigation and
 * shows a banner while either rate is non-Off.
 *
 * Mount once inside the root {@link SyncDbProvider} (not per-screen).
 */
import {Banner, Box, Text} from "@terreno/ui";
import type React from "react";
import {useCallback, useMemo} from "react";
import {View} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {
  SYNC_LAB_RATE_LABELS,
  setSyncLabLocalRate,
  setSyncLabRemoteRate,
  useSyncLabRates,
} from "@/components/syncLabRates";
import {useSyncLabEngines} from "@/hooks/useSyncLabEngines";

const describeRate = (rate: number): string => SYNC_LAB_RATE_LABELS[rate] ?? "Off";

export const SyncLabRuntime: React.FC = () => {
  const {localRate, remoteRate} = useSyncLabRates();
  const {error} = useSyncLabEngines();
  const insets = useSafeAreaInsets();

  const isRunning = localRate > 0 || remoteRate > 0;

  const bannerText = useMemo((): string => {
    const parts: string[] = [];
    if (remoteRate > 0) {
      parts.push(`Other clients ${describeRate(remoteRate)}`);
    }
    if (localRate > 0) {
      parts.push(`This client ${describeRate(localRate)}`);
    }
    return `Sync Lab running: ${parts.join(" · ")}`;
  }, [localRate, remoteRate]);

  const handleStop = useCallback((): void => {
    setSyncLabRemoteRate(0);
    setSyncLabLocalRate(0);
  }, []);

  if (!isRunning) {
    return null;
  }

  return (
    // The banner sits above the navigator, outside any screen's safe area, so it
    // has to pad the device insets itself or it slides under the notch/status bar.
    <View
      style={{
        paddingLeft: insets.left,
        paddingRight: insets.right,
        paddingTop: insets.top,
      }}
      testID="sync-lab-runtime-banner"
    >
      <Banner
        buttonOnClick={handleStop}
        buttonText="Stop"
        hasIcon
        status="warning"
        text={bannerText}
      />
      {error ? (
        <Box paddingX={3} paddingY={1}>
          <Text color="error" size="sm" testID="sync-lab-runtime-error">
            {error}
          </Text>
        </Box>
      ) : null}
    </View>
  );
};
