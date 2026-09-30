import { Participant, ParticipantSnapshot } from "./Participant";
import { VideoState, VideoStateSnapshot, SyncStatePayload } from "./VideoState";
import { RolePolicy } from "../policy/rolePolicy";
import crypto from "crypto";

export const MAX_PARTICIPANTS = 50;
export const MAX_PENDING_PER_USER = 3;
export const REQUEST_TTL_MS = 60 * 1000; // 60s per SPEC §5

export interface PendingRequest {
  requestId: string;
  fromUserId: string;
  username: string;
  type: "play" | "pause" | "seek" | "change_video";
  payload: {
    time?: number;
    url?: string;
    videoId?: string;
  };
  createdAt: number;
}

export interface RoomSnapshot {
  roomId: string;
  hostId: string;
  participants: ParticipantSnapshot[];
  videoState: VideoStateSnapshot;
  pendingRequests?: PendingRequest[];
  createdAt: number;
}

export class Room {
  public readonly roomId: string;
  public hostId: string;
  public readonly participants: Map<string, Participant>; // userId -> Participant
  public readonly video: VideoState;
  public readonly pendingRequests: Map<string, PendingRequest>; // requestId -> PendingRequest
  public readonly blockedClientIds: Set<string>;
  public readonly createdAt: number;
  public lastActiveAt: number;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private hostDisconnectTimer: NodeJS.Timeout | null = null;

  constructor(roomId: string, initialHost: Participant, initialVideoId?: string) {
    this.roomId = roomId;
    this.hostId = initialHost.userId;
    this.participants = new Map<string, Participant>();
    this.pendingRequests = new Map<string, PendingRequest>();
    this.blockedClientIds = new Set<string>();
    this.video = new VideoState(initialVideoId);
    this.createdAt = Date.now();
    this.lastActiveAt = Date.now();

    // Initial host setup
    initialHost.role = "host";
    this.participants.set(initialHost.userId, initialHost);
  }

  /**
   * Adds or reconnects a participant.
   */
  public join(participant: Participant): { participant: Participant; isReconnect: boolean } {
    this.touch();

    // Enforce blocklist (removed users cannot rejoin room) per SPEC §12
    if (this.blockedClientIds.has(participant.clientId)) {
      throw new Error("BLOCKED_FROM_ROOM");
    }

    // Check if clientId already exists (reconnection)
    const existing = this.getParticipantByClientId(participant.clientId);
    if (existing) {
      existing.reconnect(participant.socketId);
      // If reconnecting participant was the host, cancel pending host succession
      if (existing.userId === this.hostId) {
        this.cancelHostSuccession();
      }
      // Update username if provided
      if (participant.username && participant.username.trim().length > 0) {
        existing.username = participant.username;
      }
      return { participant: existing, isReconnect: true };
    }

    if (this.participants.size >= MAX_PARTICIPANTS) {
      throw new Error("ROOM_FULL");
    }

    // Resolve duplicate usernames gracefully (e.g., Alice, Alice (2))
    let finalUsername = participant.username.trim();
    let counter = 2;
    const isUsernameTaken = (name: string) =>
      Array.from(this.participants.values()).some(
        (p) => p.userId !== participant.userId && p.username.toLowerCase() === name.toLowerCase()
      );

    while (isUsernameTaken(finalUsername)) {
      finalUsername = `${participant.username.trim()} (${counter++})`;
    }
    participant.username = finalUsername;

    this.participants.set(participant.userId, participant);
    return { participant, isReconnect: false };
  }

  /**
   * Promotes or demotes a participant (Host only).
   */
  public assignRole(actorId: string, targetId: string, role: "moderator" | "participant"): Participant {
    this.touch();
    const actor = this.participants.get(actorId);
    if (!actor || actor.role !== "host") {
      throw new Error("FORBIDDEN");
    }

    if (actorId === targetId) {
      throw new Error("CANNOT_MODIFY_SELF");
    }

    const target = this.participants.get(targetId);
    if (!target) {
      throw new Error("TARGET_NOT_FOUND");
    }

    if (target.userId === this.hostId) {
      throw new Error("CANNOT_MODIFY_HOST");
    }

    target.role = role;
    if (role === "moderator") {
      this.clearRequestsForUser(targetId);
    }
    return target;
  }

  /**
   * Removes a participant from the room (Host only).
   */
  public removeParticipant(actorId: string, targetId: string): Participant {
    this.touch();
    const actor = this.participants.get(actorId);
    if (!actor || actor.role !== "host") {
      throw new Error("FORBIDDEN");
    }

    if (actorId === targetId) {
      throw new Error("CANNOT_REMOVE_SELF");
    }

    if (targetId === this.hostId) {
      throw new Error("CANNOT_REMOVE_HOST");
    }

    const target = this.participants.get(targetId);
    if (!target) {
      throw new Error("TARGET_NOT_FOUND");
    }

    this.clearRequestsForUser(targetId);
    this.blockedClientIds.add(target.clientId);
    this.participants.delete(targetId);
    return target;
  }

  /**
   * Transfers room ownership to another participant.
   * Old host becomes Moderator.
   */
  public transferHost(actorId: string, targetId: string): { oldHost: Participant; newHost: Participant } {
    this.touch();
    if (actorId !== this.hostId) {
      throw new Error("FORBIDDEN");
    }

    if (actorId === targetId) {
      throw new Error("ALREADY_HOST");
    }

    const oldHost = this.participants.get(actorId);
    const newHost = this.participants.get(targetId);

    if (!oldHost || !newHost) {
      throw new Error("PARTICIPANT_NOT_FOUND");
    }

    this.cancelHostSuccession();
    oldHost.role = "moderator";
    newHost.role = "host";
    this.hostId = targetId;

    return { oldHost, newHost };
  }

  /**
   * Automatically selects and promotes the next Host when the current host leaves or disconnects.
   * Priority: Earliest connected Moderator, else earliest connected Participant.
   */
  public performHostSuccession(): { oldHostId: string; newHostId: string } | null {
    this.cancelHostSuccession();
    const oldHostId = this.hostId;
    const candidates = Array.from(this.participants.values()).filter(
      (p) => p.userId !== oldHostId && p.connected
    );

    if (candidates.length === 0) {
      return null;
    }

    // Earliest connected moderator, else earliest connected participant
    const mods = candidates.filter((p) => p.role === "moderator").sort((a, b) => a.joinedAt - b.joinedAt);
    const viewers = candidates.filter((p) => p.role === "participant").sort((a, b) => a.joinedAt - b.joinedAt);

    const newHost = mods.length > 0 ? mods[0] : viewers[0];
    newHost.role = "host";
    this.hostId = newHost.userId;

    return { oldHostId, newHostId: newHost.userId };
  }

  /**
   * Schedules automatic host succession after 30s grace period if host disconnected.
   */
  public scheduleHostSuccession(onSuccession: (oldHostId: string, newHostId: string) => void): void {
    this.cancelHostSuccession();
    this.hostDisconnectTimer = setTimeout(() => {
      const currentHost = this.getParticipant(this.hostId);
      if (currentHost && !currentHost.connected) {
        const result = this.performHostSuccession();
        if (result) {
          onSuccession(result.oldHostId, result.newHostId);
        }
      }
    }, 30 * 1000);

    if (this.hostDisconnectTimer.unref) {
      this.hostDisconnectTimer.unref();
    }
  }

  public cancelHostSuccession(): void {
    if (this.hostDisconnectTimer) {
      clearTimeout(this.hostDisconnectTimer);
      this.hostDisconnectTimer = null;
    }
  }

  /**
   * Submits an action request from a participant.
   */
  public createRequest(
    fromParticipant: Participant,
    type: PendingRequest["type"],
    payload: PendingRequest["payload"]
  ): PendingRequest {
    this.touch();
    this.cleanupExpiredRequests();

    // Limit max 3 pending per participant per SPEC §5
    let userPendingCount = 0;
    for (const req of this.pendingRequests.values()) {
      if (req.fromUserId === fromParticipant.userId) {
        userPendingCount++;
      }
    }
    if (userPendingCount >= MAX_PENDING_PER_USER) {
      throw new Error("MAX_PENDING_REQUESTS");
    }

    const requestId = crypto.randomUUID();
    const req: PendingRequest = {
      requestId,
      fromUserId: fromParticipant.userId,
      username: fromParticipant.username,
      type,
      payload,
      createdAt: Date.now(),
    };

    this.pendingRequests.set(requestId, req);
    return req;
  }

  /**
   * Resolves a pending request (Approve or Reject) by Host or Moderator.
   */
  public resolveRequest(
    resolver: Participant,
    requestId: string,
    approve: boolean
  ): { request: PendingRequest; syncPayload?: SyncStatePayload } {
    this.touch();
    this.cleanupExpiredRequests();

    if (!RolePolicy.can(resolver.role, "resolve_request")) {
      throw new Error("FORBIDDEN");
    }

    const req = this.pendingRequests.get(requestId);
    if (!req) {
      throw new Error("REQUEST_NOT_FOUND");
    }

    this.pendingRequests.delete(requestId);

    let syncPayload: SyncStatePayload | undefined;
    if (approve) {
      if (req.type === "play") {
        syncPayload = this.video.play(req.payload.time);
      } else if (req.type === "pause") {
        syncPayload = this.video.pause();
      } else if (req.type === "seek" && req.payload.time !== undefined) {
        syncPayload = this.video.seek(req.payload.time);
      } else if (req.type === "change_video" && req.payload.videoId) {
        syncPayload = this.video.change(req.payload.videoId);
      }
    }

    return { request: req, syncPayload };
  }

  public clearRequestsForUser(userId: string): void {
    for (const [id, req] of this.pendingRequests.entries()) {
      if (req.fromUserId === userId) {
        this.pendingRequests.delete(id);
      }
    }
  }

  public cleanupExpiredRequests(): void {
    const now = Date.now();
    for (const [id, req] of this.pendingRequests.entries()) {
      if (now - req.createdAt > REQUEST_TTL_MS) {
        this.pendingRequests.delete(id);
      }
    }
  }

  public getPendingRequests(): PendingRequest[] {
    this.cleanupExpiredRequests();
    return Array.from(this.pendingRequests.values());
  }

  /**
   * Removes a participant completely from the room.
   */
  public leave(userId: string): Participant | null {
    this.touch();
    this.clearRequestsForUser(userId);
    const p = this.participants.get(userId);
    if (p) {
      this.participants.delete(userId);
      return p;
    }
    return null;
  }

  /**
   * Marks a participant as temporarily disconnected.
   */
  public disconnectParticipant(socketId: string): Participant | null {
    this.touch();
    const p = this.getParticipantBySocket(socketId);
    if (p) {
      p.disconnect();
      return p;
    }
    return null;
  }

  public getParticipant(userId: string): Participant | undefined {
    return this.participants.get(userId);
  }

  public getParticipantBySocket(socketId: string): Participant | undefined {
    for (const p of this.participants.values()) {
      if (p.socketId === socketId) {
        return p;
      }
    }
    return undefined;
  }

  public getParticipantByClientId(clientId: string): Participant | undefined {
    for (const p of this.participants.values()) {
      if (p.clientId === clientId) {
        return p;
      }
    }
    return undefined;
  }

  /**
   * Returns participant snapshots sorted by join time (host first).
   */
  public getParticipantList(): ParticipantSnapshot[] {
    return Array.from(this.participants.values())
      .sort((a, b) => {
        if (a.role === "host") return -1;
        if (b.role === "host") return 1;
        return a.joinedAt - b.joinedAt;
      })
      .map((p) => p.toSnapshot());
  }

  public touch(): void {
    this.lastActiveAt = Date.now();
  }

  public isEmpty(): boolean {
    // Empty if no connected participants
    return !Array.from(this.participants.values()).some((p) => p.connected);
  }

  /**
   * Starts periodic sync_state heartbeat every 5s while video is playing.
   */
  public startHeartbeat(broadcastFn: (payload: SyncStatePayload) => void): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.video.playState === "playing" && !this.isEmpty()) {
        broadcastFn(this.video.toSyncPayload());
      } else {
        this.stopHeartbeat();
      }
    }, 5000);

    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }
  }

  /**
   * Stops the active heartbeat timer.
   */
  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Cleans up all intervals and timers when room is deleted.
   */
  public destroy(): void {
    this.stopHeartbeat();
    this.cancelHostSuccession();
    this.pendingRequests.clear();
    this.participants.clear();
    this.blockedClientIds.clear();
  }

  public toSnapshot(): RoomSnapshot {
    return {
      roomId: this.roomId,
      hostId: this.hostId,
      participants: this.getParticipantList(),
      videoState: this.video.toSnapshot(),
      pendingRequests: this.getPendingRequests(),
      createdAt: this.createdAt,
    };
  }
}
