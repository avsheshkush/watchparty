import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { io as ClientIO, Socket } from "socket.io-client";
import { server } from "../src/index";
import { SuccessAck, ErrorAck } from "../src/handlers/ack";
import { SyncStatePayload } from "../src/rooms/VideoState";
import { PendingRequest } from "../src/rooms/Room";

describe("Phase 6 Integration: Participant Approval Workflow via Sockets", () => {
  let hostSocket: Socket;
  let modSocket: Socket;
  let participantSocket: Socket;
  const PORT = 3005;
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
      hostSocket.emit("create_room", { username: "HostAlice", clientId: "c-host-p6" }, (res: SuccessAck<{ roomId: string }>) => resolve(res));
    });
    roomId = hostAck.data.roomId;

    // Mod joins
    const modAck = await new Promise<SuccessAck<{ userId: string }>>((resolve) => {
      modSocket.emit("join_room", { roomId, username: "ModBob", clientId: "c-mod-p6" }, (res: SuccessAck<{ userId: string }>) => resolve(res));
    });
    modUserId = modAck.data.userId;

    // Promote Bob to Mod
    await new Promise<SuccessAck<unknown>>((resolve) => {
      hostSocket.emit("assign_role", { userId: modUserId, role: "moderator" }, (res: SuccessAck<unknown>) => resolve(res));
    });

    // Participant joins
    await new Promise<SuccessAck<unknown>>((resolve) => {
      participantSocket.emit("join_room", { roomId, username: "ViewerCharlie", clientId: "c-viewer-p6" }, (res: SuccessAck<unknown>) => resolve(res));
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

  it("should allow Participant to submit action_request and emit request_created ONLY to Host and Mod", async () => {
    const hostRequestPromise = new Promise<PendingRequest>((resolve) => {
      hostSocket.once("request_created", (req: PendingRequest) => resolve(req));
    });
    const modRequestPromise = new Promise<PendingRequest>((resolve) => {
      modSocket.once("request_created", (req: PendingRequest) => resolve(req));
    });

    let participantGotRequestCreated = false;
    participantSocket.on("request_created", () => {
      participantGotRequestCreated = true;
    });

    const ack = await new Promise<SuccessAck<{ requestId: string }>>((resolve) => {
      participantSocket.emit(
        "action_request",
        { type: "change_video", payload: { videoId: "dQw4w9WgXcQ" } },
        (res: SuccessAck<{ requestId: string }>) => resolve(res)
      );
    });

    expect(ack.ok).toBe(true);
    expect(ack.data.requestId).toBeDefined();

    const [hostReq, modReq] = await Promise.all([hostRequestPromise, modRequestPromise]);
    expect(hostReq.requestId).toBe(ack.data.requestId);
    expect(hostReq.type).toBe("change_video");
    expect(modReq.requestId).toBe(ack.data.requestId);
    expect(participantGotRequestCreated).toBe(false); // Participant does not receive request_created
  });

  it("should execute action and broadcast sync_state when Host approves request", async () => {
    // Participant requests play
    const ack = await new Promise<SuccessAck<{ requestId: string }>>((resolve) => {
      participantSocket.emit(
        "action_request",
        { type: "play", payload: { time: 20 } },
        (res: SuccessAck<{ requestId: string }>) => resolve(res)
      );
    });

    const requestId = ack.data.requestId;

    const syncPromise = new Promise<SyncStatePayload>((resolve) => {
      participantSocket.once("sync_state", (payload: SyncStatePayload) => resolve(payload));
    });

    const resolvedPromise = new Promise<{ requestId: string; approved: boolean }>((resolve) => {
      participantSocket.once("request_resolved", (res: { requestId: string; approved: boolean }) => resolve(res));
    });

    // Mod approves request
    const modResolveAck = await new Promise<SuccessAck<{ approved: boolean }>>((resolve) => {
      modSocket.emit("resolve_request", { requestId, approve: true }, (res: SuccessAck<{ approved: boolean }>) => resolve(res));
    });

    expect(modResolveAck.ok).toBe(true);
    expect(modResolveAck.data.approved).toBe(true);

    const [syncPayload, resolvedEvent] = await Promise.all([syncPromise, resolvedPromise]);
    expect(syncPayload.playState).toBe("playing");
    expect(resolvedEvent.requestId).toBe(requestId);
    expect(resolvedEvent.approved).toBe(true);
  });

  it("should NOT mutate state when Host rejects request", async () => {
    // Participant requests seek to 999
    const ack = await new Promise<SuccessAck<{ requestId: string }>>((resolve) => {
      participantSocket.emit(
        "action_request",
        { type: "seek", payload: { time: 999 } },
        (res: SuccessAck<{ requestId: string }>) => resolve(res)
      );
    });

    const requestId = ack.data.requestId;

    let syncReceived = false;
    const syncListener = () => {
      syncReceived = true;
    };
    participantSocket.on("sync_state", syncListener);

    // Host rejects
    const resolveAck = await new Promise<SuccessAck<{ approved: boolean }>>((resolve) => {
      hostSocket.emit("resolve_request", { requestId, approve: false }, (res: SuccessAck<{ approved: boolean }>) => resolve(res));
    });

    expect(resolveAck.ok).toBe(true);
    expect(resolveAck.data.approved).toBe(false);
    expect(syncReceived).toBe(false);

    participantSocket.off("sync_state", syncListener);
  });

  it("should prevent Participant from resolving requests (FORBIDDEN)", async () => {
    const res = await new Promise<ErrorAck>((resolve) => {
      participantSocket.emit(
        "resolve_request",
        { requestId: "some-id", approve: true },
        (response: ErrorAck) => resolve(response)
      );
    });

    expect(res.ok).toBe(false);
    expect(res.code).toBe("FORBIDDEN");
  });
});
