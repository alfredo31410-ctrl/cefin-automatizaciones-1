import "dotenv/config";
import { z } from "zod";
import { Argon2PasswordHasher } from "../auth/password.js";
import { readEnvironment } from "../config/env.js";
import { createDatabaseConnection } from "./client.js";
import { lines, userLines, users } from "./schema.js";

const adminSchema = z.object({
  ADMIN_EMAIL: z.email().trim().max(320).transform((value) => value.toLowerCase()),
  ADMIN_NAME: z.string().trim().min(2).max(160),
  ADMIN_PASSWORD: z.string().min(12).max(1_024),
});

async function createAdmin(): Promise<void> {
  const environment = readEnvironment();
  const admin = adminSchema.parse(process.env);
  const connection = createDatabaseConnection(environment.DATABASE_URL);
  const passwordHash = await new Argon2PasswordHasher().hash(admin.ADMIN_PASSWORD);

  try {
    await connection.db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({
        email: admin.ADMIN_EMAIL,
        name: admin.ADMIN_NAME,
        passwordHash,
        active: true,
      }).onConflictDoUpdate({
        target: users.email,
        set: { name: admin.ADMIN_NAME, passwordHash, active: true, updatedAt: new Date() },
      }).returning({ id: users.id });
      if (!user) throw new Error("No fue posible crear el administrador");

      const allLines = await tx.select({ id: lines.id }).from(lines);
      if (allLines.length > 0) {
        await tx.insert(userLines).values(allLines.map((line) => ({
          userId: user.id,
          lineId: line.id,
          role: "ADMIN" as const,
        }))).onConflictDoUpdate({
          target: [userLines.userId, userLines.lineId],
          set: { role: "ADMIN" },
        });
      }
    });

    console.log(`Administrador preparado para ${admin.ADMIN_EMAIL} con acceso a todas las líneas actuales.`);
  } finally {
    await connection.close();
  }
}

createAdmin().catch((error: unknown) => {
  if (error instanceof z.ZodError) {
    console.error("ADMIN_EMAIL, ADMIN_NAME y ADMIN_PASSWORD (mínimo 12 caracteres) son obligatorios.");
  } else {
    console.error(error instanceof Error ? error.message : "No fue posible crear el administrador");
  }
  process.exit(1);
});
