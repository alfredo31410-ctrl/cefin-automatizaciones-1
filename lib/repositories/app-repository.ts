import type { AppDatabase } from "@/lib/domain/types";

export interface AppRepository {
  getDatabase(): Promise<AppDatabase>;
  saveDatabase(database: AppDatabase): Promise<AppDatabase>;
}
