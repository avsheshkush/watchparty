import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Server } from "socket.io";
import { createServer, Server as HttpServer } from "http";
import { io as ClientSocket, Socket as ClientSocketType } from "socket.io-client";
import { RoomManager } from "../src/rooms/RoomManager";
import { MessageHandler } from "../src/handlers/MessageHandler";
import { ChatMessageBroadcast, ReactionBroadcast } from "../src/handlers/chatHandlers";

describe("Phase 9A: Chat & Reaction Handlers via Sockets", () => {
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

  it("should allow participants to send chat messages and broadcast to the room", async () => {
    const host = await createConnectedClient();
    const guest = await createConnectedClient();

    let roomId = "";

    // Host creates room
    await new Promise<void>((resolve) => {
      host.emit("create_room", { username: "AliceHost", clientId: "c_alice" }, (res: any) => {
        expect(res.ok).toBe(true);
        roomId = res.data.roomId;
        resolve();
      });
    });

    // Guest joins room
    await new Promise<void>((resolve) => {
      guest.emit("join_room", { roomId, username: "BobGuest", clientId: "c_bob" }, (res: any) => {
        expect(res.ok).toBe(true);
        resolve();
      });
    });

    // Host listens for chat_message
    const chatPromise = new Promise<ChatMessageBroadcast>((resolve) => {
      host.on("chat_message", (msg: ChatMessageBroadcast) => {
        resolve(msg);
      });
    });

    // Guest sends chat_message
    await new Promise<void>((resolve) => {
      guest.emit("chat_message", { text: "Hello everyone! Loving this stream!" }, (res: any) => {
        expect(res.ok).toBe(true);
        expect(res.data.text).toBe("Hello everyone! Loving this stream!");
        resolve();
      });
    });

    const received = await chatPromise;
    expect(received.username).toBe("BobGuest");
    expect(received.role).toBe("participant");
    expect(received.text).toBe("Hello everyone! Loving this stream!");
    expect(received.timestamp).toBeGreaterThan(0);

    host.disconnect();
    guest.disconnect();
  });

  it("should reject chat messages longer than 300 characters or empty", async () => {
    const client = await createConnectedClient();

    await new Promise<void>((resolve) => {
      client.emit("create_room", { username: "Alice", clientId: "c_alice" }, (res: any) => {
        expect(res.ok).toBe(true);
        resolve();
      });
    });

    // Empty message
    await new Promise<void>((resolve) => {
      client.emit("chat_message", { text: "   " }, (res: any) => {
        expect(res.ok).toBe(false);
        expect(res.code).toBe("INVALID_PAYLOAD");
        resolve();
      });
    });

    // Too long message (301 chars)
    const longText = "a".repeat(301);
    await new Promise<void>((resolve) => {
      client.emit("chat_message", { text: longText }, (res: any) => {
        expect(res.ok).toBe(false);
        expect(res.code).toBe("INVALID_PAYLOAD");
        resolve();
      });
    });

    client.disconnect();
  });

  it("should allow sending valid emoji reactions and reject disallowed emojis", async () => {
    const host = await createConnectedClient();
    const guest = await createConnectedClient();

    let roomId = "";

    await new Promise<void>((resolve) => {
      host.emit("create_room", { username: "HostAlice", clientId: "c_ha" }, (res: any) => {
        expect(res.ok).toBe(true);
        roomId = res.data.roomId;
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      guest.emit("join_room", { roomId, username: "GuestBob", clientId: "c_gb" }, (res: any) => {
        expect(res.ok).toBe(true);
        resolve();
      });
    });

    // Host listens for reaction
    const reactionPromise = new Promise<ReactionBroadcast>((resolve) => {
      host.on("reaction", (data: ReactionBroadcast) => {
        resolve(data);
      });
    });

    // Guest sends reaction 🔥
    await new Promise<void>((resolve) => {
      guest.emit("reaction", { emoji: "🔥" }, (res: any) => {
        expect(res.ok).toBe(true);
        expect(res.data.emoji).toBe("🔥");
        resolve();
      });
    });

    const received = await reactionPromise;
    expect(received.username).toBe("GuestBob");
    expect(received.emoji).toBe("🔥");

    // Invalid emoji
    await new Promise<void>((resolve) => {
      guest.emit("reaction", { emoji: "🎉" }, (res: any) => {
        expect(res.ok).toBe(false);
        expect(res.code).toBe("INVALID_PAYLOAD");
        resolve();
      });
    });

    host.disconnect();
    guest.disconnect();
  });
});
