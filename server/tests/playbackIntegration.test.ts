import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ClientIO, Socket } from "socket.io-client";
import { server } from "../src/index";
import { SuccessAck, ErrorAck } from "../src/handlers/ack";
import { SyncStatePayload } from "../src/rooms/VideoState";

describe("Phase 3 Integration: Real-Time Playback Synchronization via Sockets", () => {
  let hostSocket: Socket;
  let modSocket: Socket;
  let participantSocket: Socket;
  const PORT = 3004;
  let roomId: string;
  let modUserId: string;

  beforeAll(async () => {
    await new Promise<void>((resolve) => {
      server.listen(PORT, () => resolve());
    });

    hostSocket = ClientIO(`http://localhost:${PORT}`, { transports: ["websocket"] });
    modSocket = ClientIO(`http://localhost:${PORT}`, { transports: ["websocket"] });
    participantSocket = ClientIO(`http://localhost:${PORT}`, { transports: ["websocket"] });

    await Promise.all([
      new Promise<void>((resolve) => hostSocket.on("connect", () => resolve())),
      new Promise<void>((resolve) => modSocket.on("connect", () => resolve())),
      new Promise<void>((resolve) => participantSocket.on("connect", () => resolve())),
    ]);

    // Host creates room
    const hostAck = await new Promise<SuccessAck<{ roomId: string }>>((resolve) => {
      hostSocket.emit("create_room", { username: "HostAlice", clientId: "c-host-p3" }, (res: SuccessAck<{ roomId: string }>) => resolve(res));
    });
    roomId = hostAck.data.roomId;

    // Mod joins room
    const modAck = await new Promise<SuccessAck<{ userId: string }>>((resolve) => {
      modSocket.emit("join_room", { roomId, username: "ModBob", clientId: "c-mod-p3" }, (res: SuccessAck<{ userId: string }>) => resolve(res));
    });
    modUserId = modAck.data.userId;

    // Host promotes Bob to Moderator
    await new Promise<SuccessAck<{ role: string }>>((resolve) => {
      hostSocket.emit("assign_role", { userId: modUserId, role: "moderator" }, (res: SuccessAck<{ role: string }>) => resolve(res));
    });

    // Participant joins room
    await new Promise<SuccessAck<{ userId: string }>>((resolve) => {
      participantSocket.emit("join_room", { roomId, username: "ViewerCharlie", clientId: "c-viewer-p3" }, (res: SuccessAck<{ userId: string }>) => resolve(res));
    });
  });

  afterAll(async () => {
    if (hostSocket.connected) hostSocket.disconnect();
    if (modSocket.connected) modSocket.disconnect();
    if (participantSocket.connected) participantSocket.disconnect();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it("should allow Moderator to play video and broadcast sync_state to all clients", async () => {
    const hostSyncPromise = new Promise<SyncStatePayload>((resolve) => {
      hostSocket.once("sync_state", (payload: SyncStatePayload) => resolve(payload));
    });
    const participantSyncPromise = new Promise<SyncStatePayload>((resolve) => {
      participantSocket.once("sync_state", (payload: SyncStatePayload) => resolve(payload));
    });

    const ack = await new Promise<SuccessAck<SyncStatePayload>>((resolve) => {
      modSocket.emit("play", { time: 5 }, (response: SuccessAck<SyncStatePayload>) => resolve(response));
    });

    expect(ack.ok).toBe(true);
    expect(ack.data.playState).toBe("playing");

    const [hostSync, partSync] = await Promise.all([hostSyncPromise, participantSyncPromise]);
    expect(hostSync.playState).toBe("playing");
    expect(partSync.playState).toBe("playing");
  });

  it("should allow Moderator to seek and broadcast sync_state", async () => {
    const participantSyncPromise = new Promise<SyncStatePayload>((resolve) => {
      participantSocket.once("sync_state", (payload: SyncStatePayload) => resolve(payload));
    });

    const ack = await new Promise<SuccessAck<SyncStatePayload>>((resolve) => {
      modSocket.emit("seek", { time: 75 }, (response: SuccessAck<SyncStatePayload>) => resolve(response));
    });

    expect(ack.ok).toBe(true);
    expect(ack.data.currentTime).toBe(75);

    const partSync = await participantSyncPromise;
    expect(partSync.currentTime).toBe(75);
  });

  it("should allow Moderator to change video via URL and reset position", async () => {
    const participantSyncPromise = new Promise<SyncStatePayload>((resolve) => {
      participantSocket.once("sync_state", (payload: SyncStatePayload) => resolve(payload));
    });

    const ack = await new Promise<SuccessAck<SyncStatePayload>>((resolve) => {
      modSocket.emit(
        "change_video",
        { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
        (response: SuccessAck<SyncStatePayload>) => resolve(response)
      );
    });

    expect(ack.ok).toBe(true);
    expect(ack.data.videoId).toBe("dQw4w9WgXcQ");
    expect(ack.data.currentTime).toBe(0);

    const partSync = await participantSyncPromise;
    expect(partSync.videoId).toBe("dQw4w9WgXcQ");
  });

  it("should reject Participant playback events with FORBIDDEN and produce no broadcasts", async () => {
    let syncBroadcastReceived = false;
    const testListener = () => {
      syncBroadcastReceived = true;
    };
    hostSocket.on("sync_state", testListener);

    // Try play
    const playRes = await new Promise<ErrorAck>((resolve) => {
      participantSocket.emit("play", {}, (res: ErrorAck) => resolve(res));
    });
    expect(playRes.ok).toBe(false);
    expect(playRes.code).toBe("FORBIDDEN");

    // Try pause
    const pauseRes = await new Promise<ErrorAck>((resolve) => {
      participantSocket.emit("pause", {}, (res: ErrorAck) => resolve(res));
    });
    expect(pauseRes.ok).toBe(false);
    expect(pauseRes.code).toBe("FORBIDDEN");

    // Try seek
    const seekRes = await new Promise<ErrorAck>((resolve) => {
      participantSocket.emit("seek", { time: 100 }, (res: ErrorAck) => resolve(res));
    });
    expect(seekRes.ok).toBe(false);
    expect(seekRes.code).toBe("FORBIDDEN");

    // Try change_video
    const changeRes = await new Promise<ErrorAck>((resolve) => {
      participantSocket.emit("change_video", { videoId: "jNQXAC9IVRw" }, (res: ErrorAck) => resolve(res));
    });
    expect(changeRes.ok).toBe(false);
    expect(changeRes.code).toBe("FORBIDDEN");

    expect(syncBroadcastReceived).toBe(false);
    hostSocket.off("sync_state", testListener);
  });

  it("should supply late joiners with accurate videoState snapshot", async () => {
    const lateSocket = ClientIO(`http://localhost:${PORT}`, { transports: ["websocket"] });

    await new Promise<void>((resolve) => lateSocket.on("connect", () => resolve()));

    const statePromise = new Promise<{ videoState: { videoId: string; playState: string } }>((resolve) => {
      lateSocket.once("room_state", (data: { videoState: { videoId: string; playState: string } }) => resolve(data));
    });

    await new Promise<SuccessAck<unknown>>((resolve) => {
      lateSocket.emit("join_room", { roomId, username: "LateJoiner", clientId: "c-late" }, (res: SuccessAck<unknown>) => resolve(res));
    });

    const snapshot = await statePromise;
    expect(snapshot.videoState).toBeDefined();
    expect(snapshot.videoState.videoId).toBe("dQw4w9WgXcQ");
    expect(snapshot.videoState.playState).toBe("playing");

    lateSocket.disconnect();
  });
});
