export interface SuccessAck<T = unknown> {
  ok: true;
  data: T;
}

export interface ErrorAck {
  ok: false;
  code:
    | "FORBIDDEN"
    | "ROOM_NOT_FOUND"
    | "NOT_IN_ROOM"
    | "INVALID_PAYLOAD"
    | "INVALID_VIDEO"
    | "ROOM_FULL"
    | "RATE_LIMITED"
    | "REQUEST_NOT_FOUND"
    | "INTERNAL_ERROR";
  message: string;
}

export type AckCallback<T = unknown> = (response: SuccessAck<T> | ErrorAck) => void;

export function successAck<T = unknown>(data: T): SuccessAck<T> {
  return { ok: true, data };
}

export function errorAck(code: ErrorAck["code"], message: string): ErrorAck {
  return { ok: false, code, message };
}
