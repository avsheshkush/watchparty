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

export const playSchema = z
  .object({
    time: z.number().min(0, "Playback time cannot be negative").optional(),
  })
  .strict();

export const pauseSchema = z.object({}).strict();

export const seekSchema = z
  .object({
    time: z.number().min(0, "Seek time cannot be negative"),
  })
  .strict();

export const changeVideoSchema = z
  .object({
    url: z.string().trim().optional(),
    videoId: z.string().trim().optional(),
  })
  .refine((data) => Boolean(data.url || data.videoId), {
    message: "Either 'url' or 'videoId' must be provided",
  });

export const actionRequestSchema = z
  .object({
    type: z.enum(["play", "pause", "seek", "change_video"], {
      errorMap: () => ({ message: "Request type must be play, pause, seek, or change_video" }),
    }),
    payload: z
      .object({
        time: z.number().min(0).optional(),
        url: z.string().optional(),
        videoId: z.string().optional(),
      })
      .default({}),
  })
  .strict();

export const resolveRequestSchema = z
  .object({
    requestId: z.string().min(1, "requestId is required"),
    approve: z.boolean(),
  })
  .strict();

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type LeaveRoomInput = z.infer<typeof leaveRoomSchema>;
export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
export type RemoveParticipantInput = z.infer<typeof removeParticipantSchema>;
export type TransferHostInput = z.infer<typeof transferHostSchema>;
export type PlayInput = z.infer<typeof playSchema>;
export type PauseInput = z.infer<typeof pauseSchema>;
export type SeekInput = z.infer<typeof seekSchema>;
export type ChangeVideoInput = z.infer<typeof changeVideoSchema>;
export type ActionRequestInput = z.infer<typeof actionRequestSchema>;
export type ResolveRequestInput = z.infer<typeof resolveRequestSchema>;
