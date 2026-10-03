import dotenv from "dotenv";
import path from "path";

// Load .env file from root and fallback to process.cwd()
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config();

export interface ServerConfig {
  port: number;
  nodeEnv: "development" | "production" | "test";
  clientOrigin: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export const config: ServerConfig = {
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: (process.env.NODE_ENV as "development" | "production" | "test") || "development",
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "",
};
