import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Server } from "socket.io";
import { createServer, Server as HttpServer } from "http";
import { io as ClientSocket, Socket as ClientSocketType } from "socket.io-client";
import { RoomManager } from "../src/rooms/RoomManager";
import { MessageHandler } from "../src/handlers/MessageHandler";
import { Room } from "../src/rooms/Room";
import { Participant } from "../src/rooms/Participant";
import { SocketRateLimiter } from "../src/utils/rateLimiter";

describe("Phase 7: Hardening, Edge Cases & Resilience", () => {
  let httpServer: HttpServer;
  let ioServer: Server;
  let roomManager: RoomManager;
  let messageHandler: MessageHandler;
  let port: number;

  beforeEach(async () => {
    httpServer = createServer();
    ioServer = new Server(httpServer, {
      cors: { origin: "*" },
    });
    roomManager = new RoomManager();
    messageHandler = new MessageHandler(ioServer, roomManager);

    ioServer.on("connection", (socket) => {
      messageHandler.register(socket);
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        if (addr && typeof addr === "object") {
          port = addr.port;
        }
        resolve();
      });
    });
  });

  afterEach(async () => {
    roomManager.destroy();
    ioServer.close();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  async function createConnectedClient(): Promise<ClientSocketType> {
    const socket = ClientSocket(`http://localhost:${port}`, {
      transports: ["websocket"],
      forceNew: true,
    });
    await new Promise<void>((resolve) => {
      if (socket.connected) resolve();
      else socket.on("connect", () => resolve());
    });
    return socket;
  }

  describe("Unit: Host Succession & Timer Cleanup", () => {
    it("should promote earliest moderator on host succession", () => {
      const host = new Participant({ userId: "h1", clientId: "c_h1", socketId: "s1", username: "Host", role: "host" });
      const mod1 = new Participant({ userId: "m1", clientId: "c_m1", socketId: "s2", username: "Mod1", role: "moderator" });
      const mod2 = new Participant({ userId: "m2", clientId: "c_m2", socketId: "s3", username: "Mod2", role: "moderator" });
      const viewer = new Participant({ userId: "v1", clientId: "c_v1", socketId: "s4", username: "Viewer", role: "participant" });

      const room = new Room("TEST1", host);
      room.join(mod1);
      room.join(mod2);
      room.join(viewer);

      const succession = room.performHostSuccession();
      expect(succession).not.toBeNull();
      expect(succession?.oldHostId).toBe("h1");
      expect(succession?.newHostId).toBe("m1");
      expect(room.hostId).toBe("m1");
      expect(mod1.role).toBe("host");
    });

    it("should promote earliest participant if no moderators exist", () => {
      const host = new Participant({ userId: "h1", clientId: "c_h1", socketId: "s1", username: "Host", role: "host" });
      const viewer1 = new Participant({ userId: "v1", clientId: "c_v1", socketId: "s2", username: "Viewer1", role: "participant" });
      const viewer2 = new Participant({ userId: "v2", clientId: "c_v2", socketId: "s3", username: "Viewer2", role: "participant" });

      const room = new Room("TEST2", host);
      room.join(viewer1);
      room.join(viewer2);

      const succession = room.performHostSuccession();
      expect(succession?.newHostId).toBe("v1");
      expect(room.hostId).toBe("v1");
      expect(viewer1.role).toBe("host");
    });

    it("should handle host succession timeout grace period", () => {
      vi.useFakeTimers();
      const host = new Participant({ userId: "h1", clientId: "c_h1", socketId: "s1", username: "Host", role: "host" });
      const viewer = new Participant({ userId: "v1", clientId: "c_v1", socketId: "s2", username: "Viewer", role: "participant" });
      const room = new Room("TEST3", host);
      room.join(viewer);

      host.disconnect();

      let promoted = false;
      room.scheduleHostSuccession((oldHost, newHost) => {
        expect(oldHost).toBe("h1");
        expect(newHost).toBe("v1");
        promoted = true;
      });

      // Fast forward 15s - should not have triggered yet
      vi.advanceTimersByTime(15000);
      expect(promoted).toBe(false);

      // Fast forward past 30s
      vi.advanceTimersByTime(16000);
      expect(promoted).toBe(true);
      expect(viewer.role).toBe("host");

      vi.useRealTimers();
    });

    it("should cancel succession if host reconnects within grace period", () => {
      vi.useFakeTimers();
      const host = new Participant({ userId: "h1", clientId: "c_h1", socketId: "s1", username: "Host", role: "host" });
      const viewer = new Participant({ userId: "v1", clientId: "c_v1", socketId: "s2", username: "Viewer", role: "participant" });
      const room = new Room("TEST4", host);
      room.join(viewer);

      host.disconnect();

      let promoted = false;
      room.scheduleHostSuccession(() => {
        promoted = true;
      });

      // Advance 10s
      vi.advanceTimersByTime(10000);

      // Host reconnects with same clientId but new socket
      const reconnected = new Participant({ userId: "new_h", clientId: "c_h1", socketId: "s1_new", username: "Host", role: "participant" });
      room.join(reconnected);

      // Advance past remaining time
      vi.advanceTimersByTime(25000);
      expect(promoted).toBe(false);
      expect(host.connected).toBe(true);
      expect(host.role).toBe("host");

      vi.useRealTimers();
    });

    it("should properly destroy room resources and clear all timers", () => {
      const host = new Participant({ userId: "h1", clientId: "c_h1", socketId: "s1", username: "Host", role: "host" });
      const room = new Room("TEST5", host);
      room.startHeartbeat(() => {});

      expect(room.isEmpty()).toBe(false);
      room.destroy();
      expect(room.participants.size).toBe(0);
      expect(room.pendingRequests.size).toBe(0);
    });
  });

  describe("Integration: Blocklist & Rejoining Removed Users", () => {
    it("should prevent a removed user from re-joining the room", async () => {
      const hostClient = await createConnectedClient();
      const victimClient = await createConnectedClient();

      let roomId = "";
      let victimUserId = "";

      // 1. Host creates room
      await new Promise<void>((resolve) => {
        hostClient.emit("create_room", { username: "AliceHost", clientId: "cid_host" }, (res: any) => {
          expect(res.ok).toBe(true);
          roomId = res.data.roomId;
          resolve();
        });
      });

      // 2. Victim joins room
      await new Promise<void>((resolve) => {
        victimClient.emit("join_room", { roomId, username: "BobBad", clientId: "cid_bob" }, (res: any) => {
          expect(res.ok).toBe(true);
          victimUserId = res.data.userId;
          resolve();
        });
      });

      // 3. Host removes victim
      await new Promise<void>((resolve) => {
        hostClient.emit("remove_participant", { userId: victimUserId }, (res: any) => {
          expect(res.ok).toBe(true);
          resolve();
        });
      });

      // 4. Victim attempts to re-join using the same clientId
      await new Promise<void>((resolve) => {
        victimClient.emit("join_room", { roomId, username: "BobAgain", clientId: "cid_bob" }, (res: any) => {
          expect(res.ok).toBe(false);
          expect(res.code).toBe("FORBIDDEN");
          expect(res.message).toContain("removed");
          resolve();
        });
      });

      hostClient.disconnect();
      victimClient.disconnect();
    });
  });

  describe("Integration: Duplicate Username Disambiguation", () => {
    it("should append a suffix when a user joins with an existing username", async () => {
      const client1 = await createConnectedClient();
      const client2 = await createConnectedClient();
      const client3 = await createConnectedClient();

      let roomId = "";

      await new Promise<void>((resolve) => {
        client1.emit("create_room", { username: "Charlie", clientId: "cid_c1" }, (res: any) => {
          expect(res.ok).toBe(true);
          roomId = res.data.roomId;
          resolve();
        });
      });

      await new Promise<void>((resolve) => {
        client2.emit("join_room", { roomId, username: "Charlie", clientId: "cid_c2" }, (res: any) => {
          expect(res.ok).toBe(true);
          expect(res.data.username).toBe("Charlie (2)");
          resolve();
        });
      });

      await new Promise<void>((resolve) => {
        client3.emit("join_room", { roomId, username: "Charlie", clientId: "cid_c3" }, (res: any) => {
          expect(res.ok).toBe(true);
          expect(res.data.username).toBe("Charlie (3)");
          resolve();
        });
      });

      client1.disconnect();
      client2.disconnect();
      client3.disconnect();
    });
  });

  describe("Integration: Socket Rate Limiting", () => {
    it("should block requests when rate limit is exceeded", async () => {
      const client = await createConnectedClient();

      const serverSocket = Array.from(ioServer.sockets.sockets.values())[0];
      expect(serverSocket).toBeDefined();

      // Exhaust tokens for this socket in messageHandler's rate limiter
      for (let i = 0; i < 30; i++) {
        messageHandler.rateLimiter.allow(serverSocket.id);
      }

      // Next emit with ack should return RATE_LIMITED error ack
      const res = await new Promise<any>((resolve) => {
        client.emit("create_room", { username: "Spam", clientId: "c_spam" }, (response: any) => {
          resolve(response);
        });
      });

      expect(res.ok).toBe(false);
      expect(res.code).toBe("RATE_LIMITED");
      expect(res.message).toContain("Too many requests");

      client.disconnect();
    });
  });
});
