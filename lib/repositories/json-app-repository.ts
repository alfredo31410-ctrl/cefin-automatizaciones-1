import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDemoDatabase } from "@/lib/data/demo";
import { assertValidAppDatabase } from "@/lib/domain/database";
import type { AppDatabase } from "@/lib/domain/types";
import type { AppRepository } from "./app-repository";

const DATA_DIRECTORY = path.join(process.cwd(), ".data");
const DATABASE_PATH = path.join(DATA_DIRECTORY, "mvp-state.json");

function migrateDatabase(value: unknown): AppDatabase {
  const current = value as Partial<AppDatabase>;
  if (current.schemaVersion === 2 && Array.isArray(current.lines)) {
    const database = current as AppDatabase;
    assertValidAppDatabase(database);
    return database;
  }

  const demo = createDemoDatabase();
  const cefinId = "line-cefin";
  const legacyGroups = Array.isArray(current.groups) ? current.groups.map((group) => ({ ...group, lineId: group.lineId ?? cefinId })) : [];
  const legacyAutomations = Array.isArray(current.automations) ? current.automations.map((automation) => ({ ...automation, lineId: automation.lineId ?? cefinId })) : [];
  const automationLines = new Map(legacyAutomations.map((automation) => [automation.id, automation.lineId]));
  const legacyLogs = Array.isArray(current.eventLogs) ? current.eventLogs.map((log) => ({ ...log, lineId: log.lineId ?? automationLines.get(log.automationId) ?? cefinId })) : [];
  const additionalLineIds = new Set(demo.lines.filter((line) => line.id !== cefinId).map((line) => line.id));
  const database: AppDatabase = {
    lines: demo.lines,
    groups: [...legacyGroups, ...demo.groups.filter((group) => additionalLineIds.has(group.lineId))],
    automations: [...legacyAutomations, ...demo.automations.filter((automation) => additionalLineIds.has(automation.lineId))],
    eventLogs: [...legacyLogs, ...demo.eventLogs.filter((log) => additionalLineIds.has(log.lineId))],
    version: typeof current.version === "number" ? current.version : 1,
    schemaVersion: 2,
  };
  assertValidAppDatabase(database);
  return database;
}

export class JsonAppRepository implements AppRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  async getDatabase(): Promise<AppDatabase> {
    try {
      const stored = JSON.parse(await readFile(DATABASE_PATH, "utf8")) as unknown;
      const database = migrateDatabase(stored);
      if ((stored as Partial<AppDatabase>).schemaVersion !== 2) return this.saveDatabase(database);
      return database;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
      const database = createDemoDatabase();
      await this.saveDatabase(database);
      return database;
    }
  }

  async saveDatabase(database: AppDatabase): Promise<AppDatabase> {
    assertValidAppDatabase(database);
    const nextDatabase = { ...database, version: database.version + 1 };
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(DATA_DIRECTORY, { recursive: true });
      await writeFile(DATABASE_PATH, JSON.stringify(nextDatabase, null, 2), "utf8");
    });
    await this.writeQueue;
    return nextDatabase;
  }
}

export const appRepository: AppRepository = new JsonAppRepository();
