import {afterEach, beforeEach, describe, expect, it, mock} from "bun:test";
import type express from "express";
import {connectToMongoDB} from "./utils/database";
import {closeWebsockets, connectToWebsockets, emitToUser, getIoInstance} from "./websockets";

// Mock socket.io module
mock.module("socket.io", () => ({
  Server: class MockServer {
    to = mock(() => this);
    emit = mock(() => {});
    on = mock(() => {});
    use = mock(() => {});
    adapter = mock(() => {});
    close = mock(() => {});
  },
}));

// Mock @thream/socketio-jwt
mock.module("@thream/socketio-jwt", () => ({
  authorize: mock(() => {}),
}));

// Mock socket type for testing
type MockSocket = {
  to: ReturnType<typeof mock>;
  emit: ReturnType<typeof mock>;
  on: ReturnType<typeof mock>;
  use: ReturnType<typeof mock>;
  adapter: ReturnType<typeof mock>;
  close: ReturnType<typeof mock>;
};

describe("websockets", () => {
  let actualMockSocket: MockSocket;

  beforeEach(async () => {
    await connectToMongoDB();
    // Create a minimal Express app mock
    const mockApp = {} as express.Application;

    // Set required environment variables for websocket setup
    process.env.TOKEN_SECRET = "test-secret";
    process.env.NODE_ENV = "test";

    await connectToWebsockets(mockApp);

    // Get the io instance which should be our mock
    actualMockSocket = getIoInstance() as unknown as MockSocket;
    actualMockSocket.to = mock(() => actualMockSocket);
    actualMockSocket.emit = mock(() => {});
  });

  afterEach(async () => {
    // Clean up websocket connection
    await closeWebsockets();
  });

  it("should emit event to specific user room when io is available", () => {
    const eventName = "testEvent";
    const userId = "user123";
    const data = {message: "test data"};

    emitToUser(eventName, userId, data);

    expect(actualMockSocket.to.mock.calls.length).toBeGreaterThan(0);
    expect(actualMockSocket.to.mock.calls[0]?.[0]).toBe(userId);
    expect(actualMockSocket.emit.mock.calls.length).toBeGreaterThan(0);
    expect(actualMockSocket.emit.mock.calls[0]?.[0]).toBe(eventName);
    expect(actualMockSocket.emit.mock.calls[0]?.[1]).toEqual(data);
  });

  it("should handle various data types", () => {
    const testCases = [
      {data: "simple string", eventName: "stringData", userId: "user1"},
      {data: 42, eventName: "numberData", userId: "user2"},
      {data: true, eventName: "booleanData", userId: "user3"},
      {data: {key: "value", nested: {prop: 123}}, eventName: "objectData", userId: "user4"},
      {data: [1, 2, 3, "mixed", {type: "array"}], eventName: "arrayData", userId: "user5"},
      {data: null, eventName: "nullData", userId: "user6"},
      {data: undefined, eventName: "undefinedData", userId: "user7"},
    ];

    for (const {eventName, userId, data} of testCases) {
      // Reset mocks for each test case
      actualMockSocket.to = mock(() => actualMockSocket);
      actualMockSocket.emit = mock(() => {});

      emitToUser(eventName, userId, data);

      expect(actualMockSocket.to.mock.calls[0]?.[0]).toBe(userId);
      expect(actualMockSocket.emit.mock.calls[0]?.[0]).toBe(eventName);
      expect(actualMockSocket.emit.mock.calls[0]?.[1]).toEqual(data);
    }
  });
});
