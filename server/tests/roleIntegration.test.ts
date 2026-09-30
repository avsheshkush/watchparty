import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ClientIO, Socket } from "socket.io-client";
import { server } from "../src/index";
import { SuccessAck, ErrorAck } from "../src/handlers/ack";

describe("Phase 2 Integration: Role Assignment, Removal, and Host Transfer via Sockets", () => {
  let hostSocket: Socket;
  let participantSocket: Socket;
  const PORT = 3003;
  let roomId: string;
  let hostUserId: string;
  let participantUserId: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server.listen(PORT, () => resolve());
    });

    hostSocket = ClientIO(`http://localhost:${PORT}`, {
      transports: ["websocket"],
      reconnectionAttempts: 2,
    });
    participantSocket = ClientIO(`http://localhost:${PORT}`, {
      transports: ["websocket"],
      reconnectionAttempts: 2,
    });

    await Promise.all([
      new Promise<void>((resolve) => hostSocket.on("connect", () => resolve())),
      new Promise<void>((resolve) => participantSocket.on("connect", () => resolve())),
    ]);

    // Setup room
    const hostAck = await new Promise<SuccessAck<{ roomId: string; userId: string }>>((resolve) => {
      hostSocket.emit(
        "create_room",
        { username: "AliceHost", clientId: "c-alice-p2" },
        (res: SuccessAck<{ roomId: string; userId: string }>) => resolve(res)
      );
    });
    roomId = hostAck.data.roomId;
    hostUserId = hostAck.data.userId;

    const partAck = await new Promise<SuccessAck<{ roomId: string; userId: string }>>((resolve) => {
      participantSocket.emit(
        "join_room",
        { roomId, username: "BobViewer", clientId: "c-bob-p2" },
        (res: SuccessAck<{ roomId: string; userId: string }>) => resolve(res)
      );
    });
    participantUserId = partAck.data.userId;
  });

  afterAll(async () => {
    if (hostSocket.connected) hostSocket.disconnect();
    if (participantSocket.connected) participantSocket.disconnect();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("should reject Participant attempting to assign_role with FORBIDDEN", async () => {
    const res = await new Promise<ErrorAck>((resolve) => {
      participantSocket.emit(
        "assign_role",
        { userId: hostUserId, role: "participant" },
        (response: ErrorAck) => resolve(response)
      );
    });

    expect(res.ok).toBe(false);
    expect(res.code).toBe("FORBIDDEN");
  });

  it("should reject Participant attempting to remove_participant with FORBIDDEN", async () => {
    const res = await new Promise<ErrorAck>((resolve) => {
      participantSocket.emit(
        "remove_participant",
        { userId: hostUserId },
        (response: ErrorAck) => resolve(response)
      );
    });

    expect(res.ok).toBe(false);
    expect(res.code).toBe("FORBIDDEN");
  });

  it("should allow Host to promote Participant to Moderator and broadcast role_assigned", async () => {
    const roleAssignedPromise = new Promise<{ userId: string; role: string }>((resolve) => {
      participantSocket.once("role_assigned", (data: { userId: string; role: string }) => {
        resolve(data);
      });
    });

    const ack = await new Promise<SuccessAck<{ userId: string; role: string }>>((resolve) => {
      hostSocket.emit(
        "assign_role",
        { userId: participantUserId, role: "moderator" },
        (response: SuccessAck<{ userId: string; role: string }>) => resolve(response)
      );
    });

    expect(ack.ok).toBe(true);
    expect(ack.data.role).toBe("moderator");

    const broadcast = await roleAssignedPromise;
    expect(broadcast.userId).toBe(participantUserId);
    expect(broadcast.role).toBe("moderator");
  });

  it("should allow Host to transfer host ownership and broadcast host_transferred", async () => {
    const hostTransferredPromise = new Promise<{ oldHostId: string; newHostId: string }>((resolve) => {
      participantSocket.once("host_transferred", (data: { oldHostId: string; newHostId: string }) => {
        resolve(data);
      });
    });

    const ack = await new Promise<SuccessAck<{ hostTransferred: boolean; newHostId: string }>>((resolve) => {
      hostSocket.emit(
        "transfer_host",
        { userId: participantUserId },
        (response: SuccessAck<{ hostTransferred: boolean; newHostId: string }>) => resolve(response)
      );
    });

    expect(ack.ok).toBe(true);
    expect(ack.data.newHostId).toBe(participantUserId);

    const broadcast = await hostTransferredPromise;
    expect(broadcast.oldHostId).toBe(hostUserId);
    expect(broadcast.newHostId).toBe(participantUserId);
  });
});
