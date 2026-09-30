import { z } from "zod";

export const createRoomSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(2, "Username must be at least 2 characters")
      .max(20, "Username must be at most 20 characters"),
    clientId: z.string().trim().min(1, "clientId is required"),
  })
  .strict();

export const joinRoomSchema = z
  .object({
    roomId: z
      .string()
      .trim()
      .min(1, "Room code is required")
      .max(20, "Room code is too long"),
    username: z
      .string()
      .trim()
      .min(2, "Username must be at least 2 characters")
      .max(20, "Username must be at most 20 characters"),
    clientId: z.string().trim().min(1, "clientId is required"),
  })
  .strict();

export const leaveRoomSchema = z
  .object({
    roomId: z.string().trim().min(1, "Room code is required"),
  })
  .strict();

export const assignRoleSchema = z
  .object({
    userId: z.string().min(1, "Target userId is required"),
    role: z.enum(["moderator", "participant"], {
      errorMap: () => ({ message: "Role must be 'moderator' or 'participant'" }),
    }),
  })
  .strict();

export const removeParticipantSchema = z
  .object({
    userId: z.string().min(1, "Target userId is required"),
  })
  .strict();

export const transferHostSchema = z
  .object({
    userId: z.string().min(1, "Target userId is required"),
  })
  .strict();

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type LeaveRoomInput = z.infer<typeof leaveRoomSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type RemoveParticipantInput = z.infer<typeof removeParticipantSchema>;
export type TransferHostInput = z.infer<typeof transferHostSchema>;
