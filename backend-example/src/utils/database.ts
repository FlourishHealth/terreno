import {logger} from "@terreno/api";
import mongoose from "mongoose";
import {initConfiguration} from "../models/configuration";

export const connectToMongoDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGO_URI || "mongodb://localhost:27017/ferns-example";

  try {
    await mongoose.connect(mongoURI);
    logger.info("Connected to MongoDB");

    // Initialize configuration system after MongoDB connection
    try {
      await initConfiguration();
      logger.info("Configuration system initialized");
    } catch (error: unknown) {
      logger.error(`Failed to initialize configuration: ${error}`);
      // Continue without configuration system - fall back to env vars
    }
  } catch (error: unknown) {
    logger.error(`MongoDB connection error: ${error}`);
    throw error;
  }

  mongoose.connection.on("error", (error: unknown) => {
    logger.error(`MongoDB connection error: ${error}`);
  });

  mongoose.connection.on("disconnected", () => {
    logger.warn("MongoDB disconnected");
  });
};
