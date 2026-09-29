export interface TestDatabase {
  url: string;
  drop(): Promise<void>;
}

export function createTestDatabase(migrationsDir: string): Promise<TestDatabase>;
export function applyMigrations(url: string, migrationsDir: string): Promise<void>;
