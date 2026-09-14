import {describe, it} from "bun:test";
import {fireEvent} from "@testing-library/react-native";
import {assert} from "chai";

import {NotificationInbox, type NotificationInboxItem} from "./NotificationInbox";
import {renderWithTheme} from "./test-utils";

const items: NotificationInboxItem[] = [
  {
    body: "Unread body",
    created: "2026-09-10T12:00:00.000Z",
    href: "/todos",
    id: "n1",
    title: "Unread",
  },
  {
    body: "Read body",
    created: "2026-09-09T12:00:00.000Z",
    id: "n2",
    readAt: "2026-09-09T13:00:00.000Z",
    title: "Read",
  },
];

describe("NotificationInbox", () => {
  it("fires onOpen with the tapped item", () => {
    let opened: NotificationInboxItem | undefined;
    const {getByTestId} = renderWithTheme(
      <NotificationInbox
        items={items}
        onDismiss={() => {}}
        onMarkRead={() => {}}
        onMarkUnread={() => {}}
        onOpen={(item) => {
          opened = item;
        }}
      />
    );
    fireEvent.press(getByTestId("notification-inbox-open-n1"));
    assert.equal(opened?.id, "n1");
  });

  it("fires dismiss and mark-read callbacks", () => {
    let dismissed: NotificationInboxItem | undefined;
    let markedRead: NotificationInboxItem | undefined;
    const {getByTestId} = renderWithTheme(
      <NotificationInbox
        items={items}
        onDismiss={(item) => {
          dismissed = item;
        }}
        onMarkRead={(item) => {
          markedRead = item;
        }}
        onMarkUnread={() => {}}
        onOpen={() => {}}
      />
    );
    fireEvent.press(getByTestId("notification-inbox-dismiss-n1"));
    fireEvent.press(getByTestId("notification-inbox-mark-read-n1"));
    assert.equal(dismissed?.id, "n1");
    assert.equal(markedRead?.id, "n1");
  });

  it("fires mark-unread for a read item", () => {
    let markedUnread: NotificationInboxItem | undefined;
    const {getByTestId} = renderWithTheme(
      <NotificationInbox
        items={items}
        onDismiss={() => {}}
        onMarkRead={() => {}}
        onMarkUnread={(item) => {
          markedUnread = item;
        }}
        onOpen={() => {}}
      />
    );

    fireEvent.press(getByTestId("notification-inbox-mark-unread-n2"));

    assert.equal(markedUnread?.id, "n2");
  });

  it("shows loading and empty states", () => {
    const loading = renderWithTheme(
      <NotificationInbox
        isLoading
        items={[]}
        onDismiss={() => {}}
        onMarkRead={() => {}}
        onMarkUnread={() => {}}
        onOpen={() => {}}
      />
    );
    assert.isOk(loading.getByTestId("notification-inbox-loading"));

    const empty = renderWithTheme(
      <NotificationInbox
        items={[]}
        onDismiss={() => {}}
        onMarkRead={() => {}}
        onMarkUnread={() => {}}
        onOpen={() => {}}
      />
    );
    assert.isOk(empty.getByTestId("notification-inbox-empty"));
  });
});
