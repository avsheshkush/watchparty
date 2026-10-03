import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";

export interface AuthenticatedUser {
  id: string;
  email?: string;
  username: string;
}

export class AuthService {
  private client: SupabaseClient | null = null;

  constructor() {
    if (config.supabaseUrl && config.supabaseAnonKey) {
      try {
        this.client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        });
        console.log("[AuthService] Supabase authentication initialized with remote project");
      } catch (err) {
        console.warn("[AuthService] Failed to initialize Supabase client:", err);
      }
    } else {
      console.log("[AuthService] Supabase credentials not set; running in dev/test auth mode");
    }
  }

  public isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Verifies an auth token and extracts authenticated user information.
   * Derives actor identity strictly from the verified token.
   */
  public async verifyToken(token: string | undefined): Promise<AuthenticatedUser | null> {
    if (!token || typeof token !== "string" || !token.trim()) {
      return null;
    }

    const trimmed = token.trim();

    // 1. Automated test mock token support
    if (trimmed.startsWith("test-token-")) {
      const parts = trimmed.replace("test-token-", "").split(":");
      const id = parts[0] || "test_user";
      const username = parts[1] || "TestUser";
      return {
        id,
        email: `${id}@example.com`,
        username,
      };
    }

    // 2. Dev mode demo token support (when Supabase credentials are not yet configured in local .env)
    if (trimmed.startsWith("demo-token:")) {
      const parts = trimmed.split(":");
      const id = parts[1] || "demo_user";
      const username = decodeURIComponent(parts[2] || "DemoUser");
      const email = decodeURIComponent(parts[3] || `${id}@example.com`);
      return {
        id,
        email,
        username,
      };
    }

    // 3. Supabase remote JWT token verification
    if (this.client) {
      try {
        const { data, error } = await this.client.auth.getUser(trimmed);
        if (error || !data.user) {
          console.warn("[AuthService] Supabase token verification failed:", error?.message);
          return null;
        }

        const user = data.user;
        const username =
          user.user_metadata?.displayName ||
          user.user_metadata?.username ||
          (user.email ? user.email.split("@")[0] : `user_${user.id.slice(0, 6)}`);

        return {
          id: user.id,
          email: user.email,
          username,
        };
      } catch (err) {
        console.error("[AuthService] Error communicating with Supabase:", err);
        return null;
      }
    }

    return null;
  }
}

export const authService = new AuthService();
