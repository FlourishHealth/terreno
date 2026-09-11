import {beforeEach, describe, it, mock} from "bun:test";
import {assert} from "chai";
import React, {type ReactNode} from "react";
import {act, create, type ReactTestInstance, type ReactTestRenderer} from "react-test-renderer";

interface MockNotification {
  _id: string;
  body: string;
  created: string;
  deleted?: boolean;
  href?: string;
  readAt?: string | null;
  title: string;
}

interface MockPreference {
  _id: string;
  deleted?: boolean;
  inapp: boolean;
  mail: boolean;
  push: boolean;
  sms: boolean;
}

const createHostComponent = (name: string): React.FC<Record<string, unknown>> => {
  const HostComponent: React.FC<Record<string, unknown>> = ({children, ...props}) =>
    React.createElement(name, props, children as ReactNode);
  HostComponent.displayName = name;
  return HostComponent;
};

const notificationRows: MockNotification[] = [];
const preferenceRows: MockPreference[] = [];
let isSyncDbReady = true;

const createPreference = mock((): void => {});
const deleteNotification = mock((): void => {});
const reconcile = mock(async (): Promise<void> => {});
const routerBack = mock((): void => {});
const routerPush = mock((): void => {});
const sendTestNotification = mock(() => ({unwrap: async (): Promise<void> => {}}));
const syncMutate = mock((): void => {});
const updatePreference = mock((): void => {});

Object.assign(globalThis, {
  __DEV__: true,
  IS_REACT_ACT_ENVIRONMENT: true,
});

mock.module("@terreno/syncdb", () => ({
  generateMutationId: (): string => "generated-preference-id",
}));

mock.module("@terreno/syncdb/react", () => ({
  useQuery: (
    collection: string,
    options?: {
      filter?: (row: MockNotification | MockPreference) => boolean;
      sort?: (left: MockNotification, right: MockNotification) => number;
    }
  ): MockNotification[] | MockPreference[] => {
    if (collection === "notifications") {
      const filtered = options?.filter ? notificationRows.filter(options.filter) : notificationRows;
      return options?.sort ? [...filtered].sort(options.sort) : filtered;
    }
    return options?.filter ? preferenceRows.filter(options.filter) : preferenceRows;
  },
}));

mock.module("@terreno/ui", () => ({
  Box: createHostComponent("Box"),
  Button: createHostComponent("Button"),
  Card: createHostComponent("Card"),
  Modal: createHostComponent("Modal"),
  NotificationBell: createHostComponent("NotificationBell"),
  NotificationInbox: createHostComponent("NotificationInbox"),
  NotificationPreferences: createHostComponent("NotificationPreferences"),
  Page: createHostComponent("Page"),
  Text: createHostComponent("Text"),
}));

mock.module("expo-router", () => ({
  useRouter: () => ({back: routerBack, push: routerPush}),
}));

mock.module("@/hooks/useSyncDbReady", () => ({
  useSyncDbReady: (): boolean => isSyncDbReady,
}));

mock.module("@/store/sdk", () => ({
  usePostNotificationsDevNotifyMutation: () => [sendTestNotification, {isLoading: false}],
}));

mock.module("@/store/syncdb", () => ({
  syncDb: {mutate: syncMutate, reconcile},
}));

mock.module("@/store/syncDbSdk", () => ({
  useCreateNotificationPreference: () => [createPreference],
  useDeleteNotification: () => [deleteNotification],
  useUpdateNotificationPreference: () => [updatePreference],
}));

const {NotificationCenter} = await import("./NotificationCenter");
const {default: NotificationSettingsScreen} = await import("../app/settings/notifications");

const findHost = (renderer: ReactTestRenderer, type: string): ReactTestInstance =>
  renderer.root.findByType(type);

describe("NotificationCenter", () => {
  beforeEach(() => {
    isSyncDbReady = true;
    notificationRows.splice(
      0,
      notificationRows.length,
      {
        _id: "notification-1",
        body: "Newest body",
        created: "2026-09-11T12:00:00.000Z",
        href: "/profile",
        title: "Newest",
      },
      {
        _id: "notification-2",
        body: "Older body",
        created: "2026-09-10T12:00:00.000Z",
        title: "Older",
      }
    );
    preferenceRows.splice(0);
    createPreference.mockClear();
    deleteNotification.mockClear();
    reconcile.mockClear();
    routerPush.mockClear();
    sendTestNotification.mockClear();
    syncMutate.mockClear();
  });

  it("opens the inbox and applies notification actions", async (): Promise<void> => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(<NotificationCenter />);
    });

    act(() => {
      findHost(renderer, "NotificationBell").props.onPress();
    });
    const modal = findHost(renderer, "Modal");
    assert.isTrue(modal.props.visible);

    const inbox = findHost(renderer, "NotificationInbox");
    const item = inbox.props.items[0];
    act(() => {
      inbox.props.onMarkRead(item);
      inbox.props.onMarkUnread(item);
      inbox.props.onDismiss(item);
      inbox.props.onOpen(item);
    });

    assert.deepInclude(syncMutate.mock.calls[0]?.[0], {
      collection: "notifications",
      operation: "update",
    });
    assert.deepInclude(syncMutate.mock.calls[1]?.[0], {
      data: {readAt: null},
    });
    assert.equal(deleteNotification.mock.calls[0]?.[0].id, "notification-1");
    assert.equal(routerPush.mock.calls[0]?.[0], "/profile");

    act(() => {
      modal.props.onDismiss();
    });
    assert.isFalse(findHost(renderer, "Modal").props.visible);
  });

  it("sends a test notification and reconciles", async (): Promise<void> => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(<NotificationCenter />);
    });

    await act(async () => {
      await findHost(renderer, "Button").props.onClick();
    });

    assert.equal(sendTestNotification.mock.calls.length, 1);
    assert.equal(reconcile.mock.calls.length, 1);
  });
});

describe("NotificationSettingsScreen", () => {
  beforeEach(() => {
    isSyncDbReady = true;
    preferenceRows.splice(0);
    createPreference.mockClear();
    routerBack.mockClear();
    updatePreference.mockClear();
  });

  it("creates defaults on the first preference change and navigates back", async (): Promise<void> => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(<NotificationSettingsScreen />);
    });

    act(() => {
      findHost(renderer, "NotificationPreferences").props.onChange("mail", false);
      findHost(renderer, "Button").props.onClick();
    });

    assert.deepInclude(createPreference.mock.calls[0]?.[0], {
      id: "generated-preference-id",
    });
    assert.isFalse(createPreference.mock.calls[0]?.[0].data.mail);
    assert.equal(routerBack.mock.calls.length, 1);
  });

  it("updates an existing preference", async (): Promise<void> => {
    preferenceRows.push({
      _id: "preference-1",
      inapp: true,
      mail: true,
      push: true,
      sms: true,
    });
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(<NotificationSettingsScreen />);
    });

    act(() => {
      findHost(renderer, "NotificationPreferences").props.onChange("sms", false);
    });

    assert.deepEqual(updatePreference.mock.calls[0]?.[0], {
      data: {sms: false},
      id: "preference-1",
    });
  });
});
