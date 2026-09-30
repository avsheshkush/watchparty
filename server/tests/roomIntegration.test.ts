import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ClientIO, Socket } from "socket.io-client";
import { server } from "../src/index";
import { SuccessAck } from "../src/handlers/ack";

describe("Phase 1 Integration: Room Creation, Joining, and Leaving via Sockets", () => {
  let hostSocket: Socket;
  let participantSocket: Socket;
  const PORT = 3002;
  let createdRoomId: string;
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
  });

  afterAll(async () => {
    if (hostSocket.connected) hostSocket.disconnect();
    if (participantSocket.connected) participantSocket.disconnect();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("should allow Client 1 to create a room and become Host", async () => {
    const res = await new Promise<SuccessAck<{ roomId: string; userId: string; role: string }>>((resolve) => {
      hostSocket.emit(
        "create_room",
        { username: "AliceHost", clientId: "client-alice-uuid" },
        (response: SuccessAck<{ roomId: string; userId: string; role: string }>) => resolve(response)
      );
    });

    expect(res.ok).toBe(true);
    expect(res.data.roomId).toHaveLength(6);
    expect(res.data.role).toBe("host");
    createdRoomId = res.data.roomId;
    hostUserId = res.data.userId;
  });

  it("should allow Client 2 to join the room as Participant and receive room_state and broadcast user_joined", async () => {
    // Set up listener on Host for user_joined
    const userJoinedPromise = new Promise<{ username: string; userId: string; role: string }>((resolve) => {
      hostSocket.once("user_joined", (data: { username: string; userId: string; role: string }) => {
        resolve(data);
      });
    });

    // Set up listener on Participant for room_state
    const roomStatePromise = new Promise<{ roomId: string; you: { userId: string; role: string }; participants: unknown[] }>(
      (resolve) => {
        participantSocket.once("room_state", (state: { roomId: string; you: { userId: string; role: string }; participants: unknown[] }) => {
          resolve(state);
        });
      }
    );

    // Participant joins
    const ackRes = await new Promise<SuccessAck<{ roomId: string; userId: string; role: string }>>((resolve) => {
      participantSocket.emit(
        "join_room",
        { roomId: createdRoomId, username: "BobViewer", clientId: "client-bob-uuid" },
        (response: SuccessAck<{ roomId: string; userId: string; role: string }>) => resolve(response)
      );
    });

    expect(ackRes.ok).toBe(true);
    expect(ackRes.data.role).toBe("participant");
    participantUserId = ackRes.data.userId;

    const [joinedEvent, roomStateEvent] = await Promise.all([userJoinedPromise, roomStatePromise]);

    expect(joinedEvent.username).toBe("BobViewer");
    expect(joinedEvent.userId).toBe(participantUserId);
    expect(joinedEvent.role).toBe("participant");

    expect(roomStateEvent.roomId).toBe(createdRoomId);
    expect(roomStateEvent.you.userId).toBe(participantUserId);
    expect(roomStateEvent.you.role).toBe("participant");
    expect(roomStateEvent.participants).toHaveLength(2);
  });

  it("should broadcast user_left to the room when a participant leaves", async () => {
    const userLeftPromise = new Promise<{ username: string; userId: string }>((resolve) => {
      hostSocket.once("user_left", (data: { username: string; userId: string }) => {
        resolve(data);
      });
    });

    const leaveAck = await new Promise<SuccessAck<{ left: boolean }>>((resolve) => {
      participantSocket.emit(
        "leave_room",
        { roomId: createdRoomId },
        (response: SuccessAck<{ left: boolean }>) => resolve(response)
      );
    });

    expect(leaveAck.ok).toBe(true);
    expect(leaveAck.data.left).toBe(true);

    const leftEvent = await userLeftPromise;
    expect(leftEvent.userId).toBe(participantUserId);
    expect(leftEvent.username).toBe("BobViewer");
  });
});
