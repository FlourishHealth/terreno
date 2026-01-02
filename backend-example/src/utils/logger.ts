// Simple logger wrapper - you can replace this with a more sophisticated logging solution
export const logger = {
	debug: (...args: unknown[]): void => {
		if (process.env.NODE_ENV === "development") {
			console.debug("[DEBUG]", ...args);
		}
	},
	error: (...args: unknown[]): void => {
		console.error("[ERROR]", ...args);
	},
	info: (...args: unknown[]): void => {
		console.log("[INFO]", ...args);
	},
	warn: (...args: unknown[]): void => {
		console.warn("[WARN]", ...args);
	},
};
