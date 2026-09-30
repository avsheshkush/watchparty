import { Socket } from "socket.io";
import { RoomManager } from "../rooms/RoomManager";
import { Room } from "../rooms/Room";
import { Participant } from "../rooms/Participant";
import { Action, RolePolicy } from "../policy/rolePolicy";
import { AckCallback, errorAck } from "./ack";

export interface GuardResult {
  room: Room;
  actor: Participant;
}

/**
 * Validates that the socket belongs to an active room and that the actor has permission for the action.
 * Returns the room and actor, or sends an error ack and returns null.
 */
export function requirePermission(
  socket: Socket,
  roomManager: RoomManager,
  action: Action,
  ack?: AckCallback
): GuardResult | null {
  const found = roomManager.findBySocket(socket.id);
  if (!found) {
    ack?.(errorAck("NOT_IN_ROOM", "You are not currently in any room"));
    return null;
  }

  const { room, participant } = found;

  if (!RolePolicy.can(participant.role, action)) {
    ack?.(
      errorAck(
        "FORBIDDEN",
        `Action '${action}' is not permitted for role '${participant.role}'`
      )
    );
    return null;
  }

  return { room, actor: participant };
}
