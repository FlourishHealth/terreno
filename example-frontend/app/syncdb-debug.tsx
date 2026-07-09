/**
 * SyncDB Debugger — a Redux-DevTools-style live view over the @terreno/syncdb
 * debug event log. Left column streams events (newest first); the right column
 * inspects the selected event as JSON. Designed to run side-by-side (open in a
 * second browser window): local mutations, outbound sends, inbound server deltas
 * ("patches"), acks/nacks, conflicts, reconcile/replay and connectivity all
 * stream in live.
 *
 * The look is intentionally custom (dark, monospace, dense) rather than themed —
 * it is a developer tool. It uses raw RN primitives + a FlatList for a flat,
 * virtualized, high-throughput list, and freezes on pause so a burst can be read.
 *
 * The same data is available programmatically via `client.debug.snapshot()`,
 * which is the shape a future MCP tool will return.
 */
import type {SyncDebugEvent, SyncDebugEventType} from "@terreno/syncdb";
import {SyncDbProvider, useSyncDebugLog, useSyncStatus} from "@terreno/syncdb/react";
import {useRouter} from "expo-router";
import React, {useCallback, useMemo, useState} from "react";
import {
  FlatList,
  type ListRenderItem,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import {syncDb} from "@/store/syncdb";

const PALETTE = {
  accent: "#4c8dff",
  bg: "#0b0e14",
  border: "#1f2430",
  panel: "#11151f",
  panelAlt: "#161b26",
  rowSelected: "#1d2740",
  text: "#d7dce5",
  textDim: "#7b8496",
  textFaint: "#4b5364",
};

/** Per-type accent colors, roughly grouped by direction/outcome. */
const TYPE_COLOR: Record<SyncDebugEventType, string> = {
  ack: "#3fb950",
  conflict: "#f78166",
  connect: "#2dd4bf",
  delta: "#4c8dff",
  disconnect: "#8b949e",
  failed: "#f85149",
  mutate: "#3fb950",
  nack: "#f85149",
  reconcile: "#bc8cff",
  replay: "#bc8cff",
  resolve: "#d29922",
  retry: "#d29922",
  send: "#58a6ff",
};

const ALL_TYPES = Object.keys(TYPE_COLOR) as SyncDebugEventType[];

const ROW_HEIGHT = 34;

const monospace = Platform.select({
  default: "monospace",
  ios: "Menlo",
  web: "ui-monospace, SFMono-Regular, Menlo, monospace",
});

const formatTime = (iso: string): string => {
  // HH:mm:ss.SSS from an ISO timestamp without pulling in luxon for hot-path rendering.
  const t = iso.slice(11, 23);
  return t.length >= 8 ? t : iso;
};

const StatusPill: React.FC<{label: string; color: string}> = ({label, color}) => {
  return (
    <View
      style={{
        backgroundColor: PALETTE.panelAlt,
        borderColor: color,
        borderRadius: 4,
        borderWidth: 1,
        paddingHorizontal: 8,
        paddingVertical: 3,
      }}
    >
      <Text style={{color, fontFamily: monospace, fontSize: 11}}>{label}</Text>
    </View>
  );
};

const ToolbarButton: React.FC<{
  label: string;
  onPress: () => void;
  danger?: boolean;
  active?: boolean;
}> = ({label, onPress, danger, active}) => {
  const color = danger ? "#f85149" : active ? PALETTE.accent : PALETTE.text;
  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: active ? PALETTE.rowSelected : PALETTE.panelAlt,
        borderColor: active ? PALETTE.accent : PALETTE.border,
        borderRadius: 4,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 5,
      }}
      testID={`syncdb-debug-btn-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <Text style={{color, fontFamily: monospace, fontSize: 12}}>{label}</Text>
    </Pressable>
  );
};

interface EventRowProps {
  event: SyncDebugEvent;
  selected: boolean;
  onSelect: (event: SyncDebugEvent) => void;
}

const EventRow: React.FC<EventRowProps> = React.memo(({event, selected, onSelect}) => {
  const color = TYPE_COLOR[event.type];
  const handlePress = useCallback((): void => onSelect(event), [event, onSelect]);
  return (
    <Pressable
      onPress={handlePress}
      style={{
        alignItems: "center",
        backgroundColor: selected ? PALETTE.rowSelected : "transparent",
        borderBottomColor: PALETTE.border,
        borderBottomWidth: 1,
        flexDirection: "row",
        height: ROW_HEIGHT,
        paddingHorizontal: 10,
      }}
      testID={`syncdb-debug-row-${event.id}`}
    >
      <Text style={{color: PALETTE.textFaint, fontFamily: monospace, fontSize: 11, width: 92}}>
        {formatTime(event.timestamp)}
      </Text>
      <View
        style={{
          backgroundColor: `${color}22`,
          borderRadius: 3,
          marginRight: 8,
          minWidth: 74,
          paddingHorizontal: 6,
          paddingVertical: 2,
        }}
      >
        <Text style={{color, fontFamily: monospace, fontSize: 10, textAlign: "center"}}>
          {event.type}
          {event.phase ? `:${event.phase}` : ""}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{color: PALETTE.text, flex: 1, fontFamily: monospace, fontSize: 12}}
      >
        {event.label}
      </Text>
      {typeof event.seq === "number" ? (
        <Text style={{color: PALETTE.textDim, fontFamily: monospace, fontSize: 11, marginLeft: 8}}>
          seq {event.seq}
        </Text>
      ) : null}
    </Pressable>
  );
});
EventRow.displayName = "EventRow";

const EventDetail: React.FC<{event: SyncDebugEvent | null}> = ({event}) => {
  if (!event) {
    return (
      <View style={{alignItems: "center", flex: 1, justifyContent: "center", padding: 16}}>
        <Text style={{color: PALETTE.textFaint, fontFamily: monospace, fontSize: 12}}>
          Select an event to inspect
        </Text>
      </View>
    );
  }
  return (
    <ScrollView style={{flex: 1}} testID="syncdb-debug-detail">
      <View style={{padding: 12}}>
        <Text
          style={{
            color: TYPE_COLOR[event.type],
            fontFamily: monospace,
            fontSize: 13,
            marginBottom: 8,
          }}
        >
          #{event.id} · {event.type}
          {event.phase ? `:${event.phase}` : ""} · {event.direction}
        </Text>
        <Text style={{color: PALETTE.text, fontFamily: monospace, fontSize: 12, lineHeight: 18}}>
          {JSON.stringify(event, null, 2)}
        </Text>
      </View>
    </ScrollView>
  );
};

const SyncDebugContent: React.FC = () => {
  const router = useRouter();
  const {events, stats, clear, enabled, log} = useSyncDebugLog();
  const status = useSyncStatus();
  const [paused, setPaused] = useState<boolean>(false);
  const [frozen, setFrozen] = useState<SyncDebugEvent[]>([]);
  const [activeTypes, setActiveTypes] = useState<Set<SyncDebugEventType>>(new Set());
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const togglePause = useCallback((): void => {
    setPaused((prev) => {
      const next = !prev;
      // Freeze the current buffer when pausing so a burst can be inspected.
      setFrozen(next ? (log?.getEvents() ?? []) : []);
      return next;
    });
  }, [log]);

  const toggleType = useCallback((type: SyncDebugEventType): void => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const handleClear = useCallback((): void => {
    clear();
    setSelectedId(null);
    setFrozen([]);
  }, [clear]);

  const handleCopy = useCallback((): void => {
    const snapshot = log?.snapshot();
    if (!snapshot) {
      return;
    }
    const json = JSON.stringify(snapshot, null, 2);
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(json);
      return;
    }
    console.info("[syncdb-debug] snapshot", json);
  }, [log]);

  const source = paused ? frozen : events;

  // Newest first, filtered by the active type set (empty set = all). Recomputed
  // only when the source, filter, or pause state changes.
  const displayed = useMemo((): SyncDebugEvent[] => {
    const filtered =
      activeTypes.size === 0 ? source : source.filter((event) => activeTypes.has(event.type));
    return filtered.slice().reverse();
  }, [source, activeTypes]);

  const selected = useMemo((): SyncDebugEvent | null => {
    if (selectedId === null) {
      return null;
    }
    return source.find((event) => event.id === selectedId) ?? null;
  }, [source, selectedId]);

  const handleSelect = useCallback((event: SyncDebugEvent): void => {
    setSelectedId(event.id);
  }, []);

  const keyExtractor = useCallback((event: SyncDebugEvent): string => String(event.id), []);

  const renderItem = useCallback<ListRenderItem<SyncDebugEvent>>(
    ({item}) => <EventRow event={item} onSelect={handleSelect} selected={item.id === selectedId} />,
    [handleSelect, selectedId]
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<SyncDebugEvent> | null | undefined, index: number) => ({
      index,
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
    }),
    []
  );

  if (!enabled) {
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: PALETTE.bg,
          flex: 1,
          justifyContent: "center",
          padding: 24,
        }}
      >
        <Text style={{color: PALETTE.text, fontFamily: monospace, fontSize: 14, marginBottom: 8}}>
          SyncDB debug log is disabled
        </Text>
        <Text
          style={{color: PALETTE.textDim, fontFamily: monospace, fontSize: 12, textAlign: "center"}}
        >
          Enable it with createSyncDb(&#123; debug: true &#125;) (on by default in dev).
        </Text>
      </View>
    );
  }

  return (
    <View style={{backgroundColor: PALETTE.bg, flex: 1}} testID="syncdb-debug-screen">
      {/* Toolbar */}
      <View
        style={{
          alignItems: "center",
          borderBottomColor: PALETTE.border,
          borderBottomWidth: 1,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 8,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Text
          style={{
            color: PALETTE.text,
            fontFamily: monospace,
            fontSize: 14,
            fontWeight: "700",
            marginRight: 4,
          }}
        >
          SyncDB Debugger
        </Text>
        <StatusPill
          color={status.isOnline ? "#3fb950" : "#f85149"}
          label={status.isOnline ? "online" : "offline"}
        />
        <StatusPill
          color={status.isSyncing ? "#d29922" : PALETTE.textDim}
          label={status.isSyncing ? "syncing" : "idle"}
        />
        <StatusPill
          color={status.queuedCount > 0 ? "#d29922" : PALETTE.textDim}
          label={`queued ${status.queuedCount}`}
        />
        <StatusPill
          color={status.conflictCount > 0 ? "#f85149" : PALETTE.textDim}
          label={`conflicts ${status.conflictCount}`}
        />
        <StatusPill
          color={PALETTE.textDim}
          label={`events ${stats?.retained ?? 0}/${stats?.total ?? 0}`}
        />
        <View style={{flex: 1}} />
        <ToolbarButton active={paused} label={paused ? "Resume" : "Pause"} onPress={togglePause} />
        <ToolbarButton label="Copy JSON" onPress={handleCopy} />
        <ToolbarButton danger label="Clear" onPress={handleClear} />
        <ToolbarButton label="Close" onPress={() => router.back()} />
      </View>

      {/* Type filters */}
      <View
        style={{
          alignItems: "center",
          borderBottomColor: PALETTE.border,
          borderBottomWidth: 1,
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
        }}
      >
        {ALL_TYPES.map((type) => {
          const active = activeTypes.has(type);
          return (
            <Pressable
              key={type}
              onPress={() => toggleType(type)}
              style={{
                backgroundColor: active ? `${TYPE_COLOR[type]}33` : PALETTE.panel,
                borderColor: active ? TYPE_COLOR[type] : PALETTE.border,
                borderRadius: 3,
                borderWidth: 1,
                paddingHorizontal: 7,
                paddingVertical: 3,
              }}
              testID={`syncdb-debug-filter-${type}`}
            >
              <Text
                style={{
                  color: active ? TYPE_COLOR[type] : PALETTE.textDim,
                  fontFamily: monospace,
                  fontSize: 11,
                }}
              >
                {type} {stats?.byType[type] ?? 0}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Split: event stream + detail */}
      <View style={{flex: 1, flexDirection: "row"}}>
        <View style={{borderRightColor: PALETTE.border, borderRightWidth: 1, flex: 3}}>
          {displayed.length === 0 ? (
            <View style={{alignItems: "center", flex: 1, justifyContent: "center"}}>
              <Text style={{color: PALETTE.textFaint, fontFamily: monospace, fontSize: 12}}>
                {paused ? "Paused — no captured events" : "Waiting for sync events…"}
              </Text>
            </View>
          ) : (
            <FlatList
              data={displayed}
              getItemLayout={getItemLayout}
              initialNumToRender={30}
              keyExtractor={keyExtractor}
              maxToRenderPerBatch={30}
              removeClippedSubviews
              renderItem={renderItem}
              testID="syncdb-debug-list"
              windowSize={11}
            />
          )}
        </View>
        <View style={{backgroundColor: PALETTE.panel, flex: 2}}>
          <EventDetail event={selected} />
        </View>
      </View>
    </View>
  );
};

const SyncDebugScreen: React.FC = () => {
  return (
    <SyncDbProvider client={syncDb}>
      <SyncDebugContent />
    </SyncDbProvider>
  );
};

export default SyncDebugScreen;
