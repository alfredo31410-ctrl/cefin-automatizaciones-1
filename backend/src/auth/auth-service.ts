import { AppError } from "../domain/errors.js";
import type { AuthenticatedUser, SessionPrincipal } from "../domain/types.js";
import type { AuthRepository } from "../repositories/auth-repository.js";
import { Argon2PasswordHasher, type PasswordHasher } from "./password.js";
import { createSessionToken, hashSessionToken } from "./session.js";

const DUMMY_PASSWORD_HASH = "$argon2id$v=19$m=19456,t=2,p=1$sK4gSTmAQrFBId7xJXlcYQ$IDGTQfJfqfyaWmT3594OguCrM20oLRSXI/jLtXY9Io4";

export interface LoginResult {
  token: string;
  expiresAt: Date;
  user: AuthenticatedUser;
}

export class AuthService {
  private readonly passwordHasher: PasswordHasher;

  constructor(
    private readonly repository: AuthRepository,
    private readonly sessionTtlHours: number,
    passwordHasher?: PasswordHasher,
  ) {
    this.passwordHasher = passwordHasher ?? new Argon2PasswordHasher();
  }

  async login(email: string, password: string): Promise<LoginResult> {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await this.repository.getUserByEmail(normalizedEmail);
    const passwordHash = user?.passwordHash ?? DUMMY_PASSWORD_HASH;
    const passwordMatches = await this.passwordHasher.verify(passwordHash, password);

    if (!user || !user.active || !passwordMatches) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Correo o contraseña incorrectos");
    }

    const token = createSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + this.sessionTtlHours * 60 * 60 * 1000);
    await this.repository.createSession({ userId: user.id, tokenHash, expiresAt });
    const principal = await this.repository.getSessionPrincipal(tokenHash, new Date());
    if (!principal) throw new AppError(500, "SESSION_CREATE_FAILED", "No fue posible crear la sesión");

    return { token, expiresAt, user: principal.user };
  }

  async authenticate(token: string | undefined): Promise<SessionPrincipal> {
    if (!token) throw new AppError(401, "AUTH_REQUIRED", "Inicia sesión para continuar");
    const now = new Date();
    const principal = await this.repository.getSessionPrincipal(hashSessionToken(token), now);
    if (!principal) throw new AppError(401, "SESSION_INVALID", "La sesión expiró o ya no es válida");
    await this.repository.touchSession(principal.sessionId, now);
    return principal;
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.repository.revokeSession(hashSessionToken(token), new Date());
  }
}
