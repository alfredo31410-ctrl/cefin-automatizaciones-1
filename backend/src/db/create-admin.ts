import "dotenv/config";
import { eq } from "drizzle-orm";
import { Argon2PasswordHasher } from "../auth/password.js";
import { readEnvironment } from "../config/env.js";
import {
  AdminConfigurationError,
  adminSuccessMessage,
  parseAdminVariables,
  provisionAdmin,
  type AdminStore,
} from "./admin-provisioning.js";
import { createDatabaseConnection } from "./client.js";
import { lines, userLines, users } from "./schema.js";

async function createAdmin(): Promise<void> {
  const admin = parseAdminVariables(process.env);
  const environment = readEnvironment();
  const connection = createDatabaseConnection(environment.DATABASE_URL);

  const store: AdminStore = {
    saveAdmin: async (input) => connection.db.transaction(async (tx) => {
      const [existing] = await tx.select({ id: users.id }).from(users)
        .where(eq(users.email, input.email)).limit(1);
      const [user] = await tx.insert(users).values({
        email: input.email,
        name: input.name,
        passwordHash: input.passwordHash,
        active: input.active,
      }).onConflictDoUpdate({
        target: users.email,
        set: { name: input.name, passwordHash: input.passwordHash, active: input.active, updatedAt: new Date() },
      }).returning({ id: users.id });
      if (!user) throw new Error("ADMIN_PERSISTENCE_FAILED");

      const allLines = await tx.select({ id: lines.id }).from(lines);
      if (allLines.length > 0) {
        await tx.insert(userLines).values(allLines.map((line) => ({
          userId: user.id,
          lineId: line.id,
          role: input.role,
        }))).onConflictDoUpdate({
          target: [userLines.userId, userLines.lineId],
          set: { role: input.role },
        });
      }

      return { created: existing === undefined, assignedLineCount: allLines.length };
    }),
  };

  try {
    const result = await provisionAdmin(admin, store, new Argon2PasswordHasher());
    console.log(adminSuccessMessage(result));
  } finally {
    await connection.close();
  }
}

createAdmin().catch((error: unknown) => {
  if (error instanceof AdminConfigurationError) {
    console.error(error.message);
  } else {
    console.error("No fue posible crear o actualizar el administrador.");
  }
  process.exit(1);
});
