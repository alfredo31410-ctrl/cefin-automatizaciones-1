import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDemoDatabase } from "@/lib/data/demo";
import type { AppDatabase } from "@/lib/domain/types";
import type { AppRepository } from "./app-repository";

const DATA_DIRECTORY = path.join(process.cwd(), ".data");
const DATABASE_PATH = path.join(DATA_DIRECTORY, "mvp-state.json");

export class JsonAppRepository implements AppRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  async getDatabase(): Promise<AppDatabase> {
    try {
      return JSON.parse(await readFile(DATABASE_PATH, "utf8")) as AppDatabase;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
      const database = createDemoDatabase();
      await this.saveDatabase(database);
      return database;
    }
  }

  async saveDatabase(database: AppDatabase): Promise<AppDatabase> {
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
