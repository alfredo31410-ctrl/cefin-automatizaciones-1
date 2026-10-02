import { afterAll, describe, expect, it } from "vitest";
import { createDatabaseConnection, type DatabaseConnection } from "../src/db/client.js";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
let connection: DatabaseConnection | undefined;

describe.skipIf(!testDatabaseUrl)("PostgreSQL integration", () => {
  afterAll(async () => connection?.close());

  it("abre una conexión real", async () => {
    connection = createDatabaseConnection(testDatabaseUrl!);
    await expect(connection.healthCheck()).resolves.toBeUndefined();
  });
});
