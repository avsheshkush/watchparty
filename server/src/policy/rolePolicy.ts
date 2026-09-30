import { Role } from "../rooms/Participant";

export type Action =
  | "play"
  | "pause"
  | "seek"
  | "change_video"
  | "action_request"
  | "resolve_request"
  | "assign_role"
  | "remove_participant"
  | "transfer_host"
  | "chat_message"
  | "reaction";

// Single Source of Truth for Role Permissions per SPEC §4
const PERMISSION_MATRIX: Record<Role, Record<Action, boolean>> = {
  host: {
    play: true,
    pause: true,
    seek: true,
    change_video: true,
    action_request: false, // Privileged users execute actions directly, no need to request
    resolve_request: true,
    assign_role: true,
    remove_participant: true,
    transfer_host: true,
    chat_message: true,
    reaction: true,
  },
  moderator: {
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
  },
  participant: {
    play: false,
    pause: false,
    seek: false,
    change_video: false,
    action_request: true, // Can submit request to host/mod
    resolve_request: false,
    assign_role: false,
    remove_participant: false,
    transfer_host: false,
    chat_message: true,
    reaction: true,
  },
};

export class RolePolicy {
  /**
   * Checks whether a given role is authorized to perform an action.
   */
  public static can(role: Role, action: Action): boolean {
    const rolePermissions = PERMISSION_MATRIX[role];
    if (!rolePermissions) {
      return false;
    }
    return Boolean(rolePermissions[action]);
  }

  /**
   * Returns all allowed actions for a given role.
   */
  public static getAllowedActions(role: Role): Action[] {
    const rolePermissions = PERMISSION_MATRIX[role];
    if (!rolePermissions) return [];
    return (Object.keys(rolePermissions) as Action[]).filter(
      (action) => rolePermissions[action]
    );
  }
}
