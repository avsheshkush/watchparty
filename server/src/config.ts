import dotenv from "dotenv";
import path from "path";

// Load .env file
dotenv.config();

export interface ServerConfig {
  port: number;
  nodeEnv: "development" | "production" | "test";
  clientOrigin: string;
}

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: (process.env.NODE_ENV as "development" | "production" | "test") || "development",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
};
