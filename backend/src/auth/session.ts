import { createHash, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "cefin_session";

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(secure: boolean, maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function expiredSessionCookieOptions(secure: boolean) {
  return {
    ...sessionCookieOptions(secure, 0),
    expires: new Date(0),
  };
}
