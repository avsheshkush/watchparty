import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "http";
import express from "express";
import { Server as SocketIOServer } from "socket.io";
import { io as ioClient, Socket as ClientSocket } from "socket.io-client";
import { authService } from "../src/auth/authService";
import { RoomManager } from "../src/rooms/RoomManager";
import { MessageHandler } from "../src/handlers/MessageHandler";

describe("Supabase Authentication & Handshake", () => {
  let server: http.Server;
  let ioServer: SocketIOServer;
  let serverUrl: string;
  let roomManager: RoomManager;
  let messageHandler: MessageHandler;

  beforeAll(async () => {
    const app = express();
    server = http.createServer(app);

    ioServer = new SocketIOServer(server, {
      cors: { origin: "*" },
    });

    roomManager = new RoomManager();
    messageHandler = new MessageHandler(ioServer, roomManager);

    // Enforce authentication middleware
    ioServer.use(async (socket, next) => {
      const token = socket.handshake.auth?.token;
      if (!token) {
        return next(new Error("UNAUTHORIZED: Authentication required to join WatchParty"));
      }

      const user = await authService.verifyToken(token);
      if (user) {
        socket.data.authUser = user;
        return next();
      }

      return next(new Error("UNAUTHORIZED: Invalid auth token"));
    });

    ioServer.on("connection", (socket) => {
      messageHandler.register(socket);
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const address = server.address();
        if (address && typeof address === "object") {
          serverUrl = `http://localhost:${address.port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    ioServer.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("should reject connection when no auth token is provided", async () => {
    const client = ioClient(serverUrl, {
      transports: ["websocket"],
      reconnection: false,
    });

    const errorPromise = new Promise<string>((resolve) => {
      client.on("connect_error", (err) => {
        resolve(err.message);
      });
    });

    const message = await errorPromise;
    expect(message).toContain("UNAUTHORIZED: Authentication required to join WatchParty");
    client.disconnect();
  });

  it("should reject connection when invalid token is provided", async () => {
    const client = ioClient(serverUrl, {
      transports: ["websocket"],
      auth: { token: "bad_random_invalid_token" },
      reconnection: false,
    });

    const errorPromise = new Promise<string>((resolve) => {
      client.on("connect_error", (err) => {
        resolve(err.message);
      });
    });

    const message = await errorPromise;
    expect(message).toContain("UNAUTHORIZED: Invalid auth token");
    client.disconnect();
  });

  it("should allow connection with valid test auth token and derive actor identity", async () => {
    const client = ioClient(serverUrl, {
      transports: ["websocket"],
      auth: { token: "test-token-user123:AliceVerified" },
      reconnection: false,
    });

    await new Promise<void>((resolve, reject) => {
      client.on("connect", () => resolve());
      client.on("connect_error", (err) => reject(err));
    });

    expect(client.connected).toBe(true);

    // Create room with authenticated client
    const ack = await new Promise<any>((resolve) => {
      client.emit(
        "create_room",
        { username: "IgnoredUsername", clientId: "c_ignored" },
        (res: any) => resolve(res)
      );
    });

    expect(ack.ok).toBe(true);
    // Verified username and userId must be derived from token
    expect(ack.data.userId).toBe("user123");
    expect(ack.data.role).toBe("host");
    expect(ack.data.state.participants[0].username).toBe("AliceVerified");

    client.disconnect();
  });

  it("should verify mock demo tokens when Supabase is running in dev mode", async () => {
    const verified = await authService.verifyToken("demo-token:supa_user_456:BobMarley:bob%40example.com");
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe("supa_user_456");
    expect(verified?.username).toBe("BobMarley");
    expect(verified?.email).toBe("bob@example.com");
  });
});
