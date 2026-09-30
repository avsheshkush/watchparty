import { describe, it, expect, beforeEach } from "vitest";
import { Room } from "../src/rooms/Room";
import { Participant } from "../src/rooms/Participant";
import { RoomManager } from "../src/rooms/RoomManager";

describe("Room & Participant Domain Logic", () => {
  let initialHost: Participant;
  let room: Room;

  beforeEach(() => {
    initialHost = new Participant({
      userId: "user-host-1",
      clientId: "client-host-1",
      socketId: "socket-host-1",
      username: "AliceHost",
      role: "host",
    });
    room = new Room("TEST01", initialHost);
  });

  it("should initialize room with creator as host", () => {
    expect(room.roomId).toBe("TEST01");
    expect(room.hostId).toBe("user-host-1");
    expect(room.participants.size).toBe(1);
    const host = room.getParticipant("user-host-1");
    expect(host?.role).toBe("host");
  });

  it("should allow a new participant to join", () => {
    const bob = new Participant({
      userId: "user-bob-2",
      clientId: "client-bob-2",
      socketId: "socket-bob-2",
      username: "Bob",
    });

    const { participant, isReconnect } = room.join(bob);
    expect(isReconnect).toBe(false);
    expect(participant.role).toBe("participant");
    expect(room.participants.size).toBe(2);
  });

  it("should reconnect participant with same clientId", () => {
    const bob = new Participant({
      userId: "user-bob-2",
      clientId: "client-bob-2",
      socketId: "socket-bob-2",
      username: "Bob",
    });
    room.join(bob);

    // Reconnecting with new socket
    const bobReconnect = new Participant({
      userId: "new-user-id", // will be ignored in favor of existing
      clientId: "client-bob-2",
      socketId: "socket-bob-reconnected",
      username: "BobUpdated",
    });

    const { participant, isReconnect } = room.join(bobReconnect);
    expect(isReconnect).toBe(true);
    expect(participant.userId).toBe("user-bob-2"); // preserved
    expect(participant.socketId).toBe("socket-bob-reconnected");
    expect(participant.username).toBe("BobUpdated");
    expect(room.participants.size).toBe(2);
  });

  it("should allow a participant to leave", () => {
    const bob = new Participant({
      userId: "user-bob-2",
      clientId: "client-bob-2",
      socketId: "socket-bob-2",
      username: "Bob",
    });
    room.join(bob);
    expect(room.participants.size).toBe(2);

    const left = room.leave("user-bob-2");
    expect(left?.userId).toBe("user-bob-2");
    expect(room.participants.size).toBe(1);
  });

  it("should enforce maximum capacity of 50 participants", () => {
    for (let i = 1; i < 50; i++) {
      room.join(
        new Participant({
          userId: `user-${i}`,
          clientId: `client-${i}`,
          socketId: `socket-${i}`,
          username: `User${i}`,
        })
      );
    }
    expect(room.participants.size).toBe(50);

    // 51st participant should throw ROOM_FULL
    expect(() => {
      room.join(
        new Participant({
          userId: "user-51",
          clientId: "client-51",
          socketId: "socket-51",
          username: "User51",
        })
      );
    }).toThrow("ROOM_FULL");
  });
});

describe("RoomManager", () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  it("should create a room and assign host", () => {
    const { room, host } = roomManager.createRoom({
      username: "HostUser",
      clientId: "client-host",
      socketId: "socket-host",
    });

    expect(room.roomId).toHaveLength(6);
    expect(host.role).toBe("host");
    expect(roomManager.getRoom(room.roomId)).toBe(room);
  });

  it("should find room by socket id", () => {
    const { room, host } = roomManager.createRoom({
      username: "HostUser",
      clientId: "client-host",
      socketId: "socket-host-xyz",
    });

    const found = roomManager.findBySocket("socket-host-xyz");
    expect(found).toBeDefined();
    expect(found?.room.roomId).toBe(room.roomId);
    expect(found?.participant.userId).toBe(host.userId);
  });
});
