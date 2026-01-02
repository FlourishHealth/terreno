/**
 * Example script demonstrating database-backed configuration
 *
 * Run with: bun run src/scripts/configuration-example.ts
 */

import mongoose from "mongoose";
import {Configuration, ConfigurationDB} from "../models/configuration";
import {connectToMongoDB} from "../utils/database";
import {logger} from "../utils/logger";

const main = async (): Promise<void> => {
	try {
		// 1. Connect to MongoDB (this also initializes configuration)
		logger.info("Connecting to MongoDB...");
		await connectToMongoDB();

		// 2. Register a custom configuration
		Configuration.register("EXAMPLE_FEATURE_FLAG", {
			defaultValue: false,
			description: "Example feature flag",
			type: "boolean",
		});

		Configuration.register("EXAMPLE_MAX_RETRIES", {
			defaultValue: 3,
			description: "Maximum retry attempts (1-10)",
			type: "number",
			validator: (value) => typeof value === "number" && value > 0 && value <= 10,
		});

		// 3. Get current values (from env vars or defaults)
		logger.info("\n=== Current Configuration ===");
		logger.info(`EXAMPLE_FEATURE_FLAG: ${Configuration.get<boolean>("EXAMPLE_FEATURE_FLAG")}`);
		logger.info(`EXAMPLE_MAX_RETRIES: ${Configuration.get<number>("EXAMPLE_MAX_RETRIES")}`);

		// 4. Save configuration to database
		logger.info("\n=== Saving to Database ===");
		await Configuration.setDB("EXAMPLE_FEATURE_FLAG", true);
		await Configuration.setDB("EXAMPLE_MAX_RETRIES", 5);
		logger.info("Configuration saved to database");

		// 5. Wait for change stream to update cache
		logger.info("\n=== Waiting for change stream ===");
		await new Promise((resolve) => setTimeout(resolve, 500));

		// 6. Get updated values from cache
		logger.info("\n=== Updated Configuration (from cache) ===");
		logger.info(`EXAMPLE_FEATURE_FLAG: ${Configuration.get<boolean>("EXAMPLE_FEATURE_FLAG")}`);
		logger.info(`EXAMPLE_MAX_RETRIES: ${Configuration.get<number>("EXAMPLE_MAX_RETRIES")}`);

		// 7. Show database cache
		logger.info("\n=== Database Cache ===");
		const dbCache = Configuration.getDBCache();
		logger.info(JSON.stringify(dbCache, null, 2));

		// 8. Direct database access
		logger.info("\n=== Direct Database Access ===");
		const allConfigs = await ConfigurationDB.find({});
		logger.info(`Total configurations in database: ${allConfigs.length}`);
		for (const config of allConfigs) {
			logger.info(`  ${config.key} = ${config.value} (${config.type})`);
		}

		// 9. Test runtime override
		logger.info("\n=== Runtime Override ===");
		Configuration.set("EXAMPLE_MAX_RETRIES", 7);
		logger.info(`With override: ${Configuration.get<number>("EXAMPLE_MAX_RETRIES")}`);

		Configuration.clear("EXAMPLE_MAX_RETRIES");
		logger.info(`After clearing override: ${Configuration.get<number>("EXAMPLE_MAX_RETRIES")}`);

		// 10. Test validation
		logger.info("\n=== Validation Test ===");
		try {
			await Configuration.setDB("EXAMPLE_MAX_RETRIES", 99); // Should fail (> 10)
			logger.error("Validation should have failed!");
		} catch (error) {
			logger.info(`Validation correctly prevented invalid value: ${error}`);
		}

		// 11. Cleanup
		logger.info("\n=== Cleanup ===");
		await ConfigurationDB.deleteMany({
			key: {$in: ["EXAMPLE_FEATURE_FLAG", "EXAMPLE_MAX_RETRIES"]},
		});
		logger.info("Example configurations deleted from database");

		// Shutdown
		await Configuration.shutdown();
		await mongoose.disconnect();
		logger.info("\n=== Example Complete ===");
	} catch (error: unknown) {
		logger.error(`Error: ${error}`);
		process.exit(1);
	}
};

// Run the example
main().catch((error: unknown) => {
	logger.error(`Unhandled error: ${error}`);
	process.exit(1);
});
