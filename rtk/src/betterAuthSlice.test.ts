import {beforeEach, describe, expect, it, mock} from "bun:test";
import {
  type BetterAuthState,
  generateBetterAuthSlice,
  selectBetterAuthError,
  selectBetterAuthIsAuthenticated,
  selectBetterAuthIsLoading,
  selectBetterAuthUser,
  selectBetterAuthUserId,
} from "./betterAuthSlice";
import type {BetterAuthClientConfig, BetterAuthUser} from "./betterAuthTypes";

// Mock Better Auth client
const createMockAuthClient = () => ({
  getSession: mock(() =>
    Promise.resolve({
      data: {
        session: {
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 3600000),
          id: "session-456",
          ipAddress: null,
          updatedAt: new Date(),
          userAgent: null,
          userId: "user-123",
        },
        user: {
          createdAt: new Date(),
          email: "test@example.com",
          emailVerified: true,
          id: "user-123",
          image: null,
          name: "Test User",
          updatedAt: new Date(),
        },
      },
    })
  ),
  signIn: {
    email: mock(() => Promise.resolve({data: {user: {id: "user-123"}}})),
    social: mock(() => Promise.resolve({data: {user: {id: "user-123"}}})),
  },
  signOut: mock(() => Promise.resolve()),
  signUp: {
    email: mock(() => Promise.resolve({data: {user: {id: "user-123"}}})),
  },
});

describe("BetterAuthClientConfig", () => {
  it("defines config interface correctly", () => {
    const config: BetterAuthClientConfig = {
      baseURL: "http://localhost:3000",
      scheme: "terreno",
      storagePrefix: "myapp",
    };

    expect(config.baseURL).toBe("http://localhost:3000");
    expect(config.scheme).toBe("terreno");
    expect(config.storagePrefix).toBe("myapp");
  });

  it("allows minimal config without storagePrefix", () => {
    const config: BetterAuthClientConfig = {
      baseURL: "http://localhost:3000",
      scheme: "terreno",
    };

    expect(config.storagePrefix).toBeUndefined();
  });
});

describe("generateBetterAuthSlice", () => {
  let mockAuthClient: ReturnType<typeof createMockAuthClient>;

  beforeEach(() => {
    mockAuthClient = createMockAuthClient();
  });

  it("creates a slice with initial state", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Mock client type
    const betterAuthSlice = generateBetterAuthSlice({authClient: mockAuthClient as any});

    const initialState = betterAuthSlice.reducer(undefined, {type: "@@INIT"});

    expect(initialState.isAuthenticated).toBe(false);
    expect(initialState.userId).toBeNull();
    expect(initialState.user).toBeNull();
    expect(initialState.isLoading).toBe(true);
    expect(initialState.error).toBeNull();
  });

  it("setSession action updates state correctly", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Mock client type
    const betterAuthSlice = generateBetterAuthSlice({authClient: mockAuthClient as any});

    const user: BetterAuthUser = {
      createdAt: new Date(),
      email: "test@example.com",
      emailVerified: true,
      id: "user-123",
      image: null,
      name: "Test User",
      updatedAt: new Date(),
    };

    const state = betterAuthSlice.reducer(
      undefined,
      betterAuthSlice.actions.setSession({user, userId: "user-123"})
    );

    expect(state.isAuthenticated).toBe(true);
    expect(state.userId).toBe("user-123");
    expect(state.user?.email).toBe("test@example.com");
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("clearSession action resets state", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Mock client type
    const betterAuthSlice = generateBetterAuthSlice({authClient: mockAuthClient as any});

    // First set a session
    let state = betterAuthSlice.reducer(
      undefined,
      betterAuthSlice.actions.setSession({
        user: {
          createdAt: new Date(),
          email: "test@example.com",
          emailVerified: true,
          id: "user-123",
          image: null,
          name: "Test",
          updatedAt: new Date(),
        },
        userId: "user-123",
      })
    );

    // Then clear it
    state = betterAuthSlice.reducer(state, betterAuthSlice.actions.clearSession());

    expect(state.isAuthenticated).toBe(false);
    expect(state.userId).toBeNull();
    expect(state.user).toBeNull();
  });

  it("setLoading action updates loading state", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Mock client type
    const betterAuthSlice = generateBetterAuthSlice({authClient: mockAuthClient as any});

    let state = betterAuthSlice.reducer(undefined, betterAuthSlice.actions.setLoading(true));
    expect(state.isLoading).toBe(true);

    state = betterAuthSlice.reducer(state, betterAuthSlice.actions.setLoading(false));
    expect(state.isLoading).toBe(false);
  });

  it("setError action updates error state", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Mock client type
    const betterAuthSlice = generateBetterAuthSlice({authClient: mockAuthClient as any});

    const state = betterAuthSlice.reducer(
      undefined,
      betterAuthSlice.actions.setError("Something went wrong")
    );

    expect(state.error).toBe("Something went wrong");
    expect(state.isLoading).toBe(false);
  });

  it("logout action clears session state", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Mock client type
    const betterAuthSlice = generateBetterAuthSlice({authClient: mockAuthClient as any});

    // First set a session
    let state = betterAuthSlice.reducer(
      undefined,
      betterAuthSlice.actions.setSession({
        user: {
          createdAt: new Date(),
          email: "test@example.com",
          emailVerified: true,
          id: "user-123",
          image: null,
          name: "Test",
          updatedAt: new Date(),
        },
        userId: "user-123",
      })
    );

    // Then logout
    state = betterAuthSlice.reducer(state, betterAuthSlice.actions.logout());

    expect(state.isAuthenticated).toBe(false);
    expect(state.userId).toBeNull();
    expect(state.user).toBeNull();
  });

  it("returns middleware array", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Mock client type
    const betterAuthSlice = generateBetterAuthSlice({authClient: mockAuthClient as any});

    expect(Array.isArray(betterAuthSlice.middleware)).toBe(true);
    expect(betterAuthSlice.middleware.length).toBeGreaterThan(0);
  });

  it("returns authClient reference", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Mock client type
    const betterAuthSlice = generateBetterAuthSlice({authClient: mockAuthClient as any});

    // biome-ignore lint/suspicious/noExplicitAny: Mock client type comparison
    expect(betterAuthSlice.authClient).toBe(mockAuthClient as any);
  });

  it("syncSession function updates state from auth client", async () => {
    // biome-ignore lint/suspicious/noExplicitAny: Mock client type
    const betterAuthSlice = generateBetterAuthSlice({authClient: mockAuthClient as any});

    // biome-ignore lint/suspicious/noExplicitAny: Test mock for dispatched actions
    const dispatchedActions: any[] = [];
    // biome-ignore lint/suspicious/noExplicitAny: Test mock dispatch function
    const mockDispatch = (action: any) => {
      dispatchedActions.push(action);
    };

    await betterAuthSlice.syncSession(mockDispatch);

    // Should dispatch setLoading(true) then setSession
    expect(dispatchedActions.length).toBeGreaterThanOrEqual(2);
    expect(dispatchedActions[0].type).toBe("betterAuth/setLoading");
  });
});

describe("Better Auth selectors", () => {
  // biome-ignore lint/suspicious/noExplicitAny: Test mock state factory
  const createMockState = (betterAuth: Partial<BetterAuthState> = {}): any => ({
    betterAuth: {
      error: null,
      isAuthenticated: false,
      isLoading: false,
      lastSyncTimestamp: null,
      user: null,
      userId: null,
      ...betterAuth,
    },
  });

  it("selectBetterAuthIsAuthenticated returns correct value", () => {
    expect(selectBetterAuthIsAuthenticated(createMockState({isAuthenticated: true}))).toBe(true);
    expect(selectBetterAuthIsAuthenticated(createMockState({isAuthenticated: false}))).toBe(false);
  });

  it("selectBetterAuthUserId returns correct value", () => {
    expect(selectBetterAuthUserId(createMockState({userId: "user-123"}))).toBe("user-123");
    expect(selectBetterAuthUserId(createMockState({userId: null}))).toBeNull();
  });

  it("selectBetterAuthUser returns correct value", () => {
    const user: BetterAuthUser = {
      createdAt: new Date(),
      email: "test@example.com",
      emailVerified: true,
      id: "user-123",
      image: null,
      name: "Test",
      updatedAt: new Date(),
    };

    expect(selectBetterAuthUser(createMockState({user}))?.email).toBe("test@example.com");
    expect(selectBetterAuthUser(createMockState({user: null}))).toBeNull();
  });

  it("selectBetterAuthIsLoading returns correct value", () => {
    expect(selectBetterAuthIsLoading(createMockState({isLoading: true}))).toBe(true);
    expect(selectBetterAuthIsLoading(createMockState({isLoading: false}))).toBe(false);
  });

  it("selectBetterAuthError returns correct value", () => {
    expect(selectBetterAuthError(createMockState({error: "Error message"}))).toBe("Error message");
    expect(selectBetterAuthError(createMockState({error: null}))).toBeNull();
  });

  it("selectors handle missing betterAuth state gracefully", () => {
    // biome-ignore lint/suspicious/noExplicitAny: Test empty state for selector edge case
    const emptyState = {} as any;

    expect(selectBetterAuthIsAuthenticated(emptyState)).toBe(false);
    expect(selectBetterAuthUserId(emptyState)).toBeNull();
    expect(selectBetterAuthUser(emptyState)).toBeNull();
    expect(selectBetterAuthIsLoading(emptyState)).toBe(false);
    expect(selectBetterAuthError(emptyState)).toBeNull();
  });
});

describe("BetterAuthUser interface", () => {
  it("defines user data structure correctly", () => {
    const user: BetterAuthUser = {
      createdAt: new Date("2024-01-01"),
      email: "test@example.com",
      emailVerified: true,
      id: "user-123",
      image: "https://example.com/avatar.jpg",
      name: "Test User",
      updatedAt: new Date("2024-01-02"),
    };

    expect(user.id).toBe("user-123");
    expect(user.email).toBe("test@example.com");
    expect(user.name).toBe("Test User");
    expect(user.image).toBe("https://example.com/avatar.jpg");
    expect(user.emailVerified).toBe(true);
  });

  it("allows null values for optional fields", () => {
    const user: BetterAuthUser = {
      createdAt: new Date(),
      email: "test@example.com",
      emailVerified: false,
      id: "user-123",
      image: null,
      name: null,
      updatedAt: new Date(),
    };

    expect(user.name).toBeNull();
    expect(user.image).toBeNull();
  });
});
