import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ClientIO, Socket } from "socket.io-client";
import { server } from "../src/index";

describe("Phase 0 Smoke Test: Server & Socket.IO Connection", () => {
  let clientSocket: Socket;
  const PORT = 3001;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server.listen(PORT, () => {
        resolve();
      });
    });

    clientSocket = ClientIO(`http://localhost:${PORT}`, {
      transports: ["websocket"],
      reconnectionAttempts: 2,
    });

    await new Promise<void>((resolve) => {
      clientSocket.on("connect", () => {
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("should connect successfully and assign a socket id", () => {
    expect(clientSocket.connected).toBe(true);
    expect(clientSocket.id).toBeDefined();
  });

  it("should respond to ping with pong via ack callback", async () => {
    const payload = { test: "smoke_ping", sentAt: Date.now() };

    const response = await new Promise<{ message: string; serverTime: number; echo: unknown }>((resolve) => {
      clientSocket.emit("ping", payload, (res: { message: string; serverTime: number; echo: unknown }) => {
        resolve(res);
      });
    });

    expect(response).toBeDefined();
    expect(response.message).toBe("pong");
    expect(response.serverTime).toBeGreaterThan(0);
    expect(response.echo).toEqual(payload);
  });
});
