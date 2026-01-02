import {User} from "../models/user";
import type {UserDocument} from "../types";

/**
 * Create a test user with default or custom data
 */
export const createTestUser = async (
	data?: Partial<{email: string; name: string}>
): Promise<UserDocument> => {
	const defaultData = {
		email: `test-${Date.now()}@example.com`,
		name: "Test User",
	};

	const user = await User.create({
		...defaultData,
		...data,
	});

	return user;
};

/**
 * Generate a unique email for testing
 */
export const generateTestEmail = (): string => {
	return `test-${Date.now()}-${Math.random().toString(36).substring(7)}@example.com`;
};

/**
 * Clean up all test data
 */
export const cleanupTestData = async (): Promise<void> => {
	await User.deleteMany({});
};
