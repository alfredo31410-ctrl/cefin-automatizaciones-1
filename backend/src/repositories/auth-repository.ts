import type { SessionPrincipal, UserRecord } from "../domain/types.js";

export interface CreateSessionInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface AuthRepository {
  getUserByEmail(email: string): Promise<UserRecord | null>;
  createSession(input: CreateSessionInput): Promise<void>;
  getSessionPrincipal(tokenHash: string, now: Date): Promise<SessionPrincipal | null>;
  touchSession(sessionId: string, now: Date): Promise<void>;
  revokeSession(tokenHash: string, now: Date): Promise<void>;
}
