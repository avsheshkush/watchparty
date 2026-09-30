import { describe, it, expect, beforeEach } from "vitest";
import { RolePolicy, Action } from "../src/policy/rolePolicy";
import { Role, Participant } from "../src/rooms/Participant";
import { Room } from "../src/rooms/Room";

describe("RolePolicy Permission Matrix (SPEC §4)", () => {
  const actions: Action[] = [
    "play",
    "pause",
    "seek",
    "change_video",
    "action_request",
    "resolve_request",
    "assign_role",
    "remove_participant",
    "transfer_host",
    "chat_message",
    "reaction",
  ];

  it("should match Host permissions exactly", () => {
    const expectedAllowed: Record<Action, boolean> = {
      play: true,
      pause: true,
      seek: true,
      change_video: true,
      action_request: false,
      resolve_request: true,
      assign_role: true,
      remove_participant: true,
      transfer_host: true,
      chat_message: true,
      reaction: true,
    };

    for (const action of actions) {
      expect(RolePolicy.can("host", action)).toBe(expectedAllowed[action]);
    }
  });

  it("should match Moderator permissions exactly", () => {
    const expectedAllowed: Record<Action, boolean> = {
      play: true,
      pause: true,
      seek: true,
      change_video: true,
      action_request: false,
      resolve_request: true,
      assign_role: false,
      remove_participant: false,
      transfer_host: false,
      chat_message: true,
      reaction: true,
    };

    for (const action of actions) {
      expect(RolePolicy.can("moderator", action)).toBe(expectedAllowed[action]);
    }
  });

  it("should match Participant permissions exactly", () => {
    const expectedAllowed: Record<Action, boolean> = {
      play: false,
      pause: false,
      seek: false,
      change_video: false,
      action_request: true,
      resolve_request: false,
      assign_role: false,
      remove_participant: false,
      transfer_host: false,
      chat_message: true,
      reaction: true,
    };

    for (const action of actions) {
      expect(RolePolicy.can("participant", action)).toBe(expectedAllowed[action]);
    }
  });
});

describe("Room Role Mutation Edge Cases", () => {
  let host: Participant;
  let mod: Participant;
  let viewer: Participant;
  let room: Room;

  beforeEach(() => {
    host = new Participant({
      userId: "u-host",
      clientId: "c-host",
      socketId: "s-host",
      username: "HostUser",
      role: "host",
    });
    room = new Room("TEST02", host);

    viewer = new Participant({
      userId: "u-viewer",
      clientId: "c-viewer",
      socketId: "s-viewer",
      username: "ViewerUser",
      role: "participant",
    });
    room.join(viewer);

    mod = new Participant({
      userId: "u-mod",
      clientId: "c-mod",
      socketId: "s-mod",
      username: "ModUser",
      role: "moderator",
    });
    room.join(mod);
    mod.role = "moderator";
  });

  it("should allow Host to promote Participant to Moderator", () => {
    const updated = room.assignRole(host.userId, viewer.userId, "moderator");
    expect(updated.role).toBe("moderator");
  });

  it("should prevent non-host (Moderator or Participant) from assigning roles", () => {
    expect(() => room.assignRole(mod.userId, viewer.userId, "participant")).toThrow("FORBIDDEN");
    expect(() => room.assignRole(viewer.userId, mod.userId, "participant")).toThrow("FORBIDDEN");
  });

  it("should prevent assigning role to self", () => {
    expect(() => room.assignRole(host.userId, host.userId, "participant")).toThrow("CANNOT_MODIFY_SELF");
  });

  it("should prevent demoting or modifying the Host role via assignRole", () => {
    expect(() => room.assignRole(host.userId, host.userId, "moderator")).toThrow();
  });

  it("should allow Host to remove a participant", () => {
    const removed = room.removeParticipant(host.userId, viewer.userId);
    expect(removed.userId).toBe(viewer.userId);
    expect(room.getParticipant(viewer.userId)).toBeUndefined();
  });

  it("should prevent removing the Host", () => {
    expect(() => room.removeParticipant(host.userId, host.userId)).toThrow("CANNOT_REMOVE_SELF");
  });

  it("should allow Host to transfer ownership to another participant", () => {
    const result = room.transferHost(host.userId, mod.userId);
    expect(result.oldHost.role).toBe("moderator");
    expect(result.newHost.role).toBe("host");
    expect(room.hostId).toBe(mod.userId);
  });
});
