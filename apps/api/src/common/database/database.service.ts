import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { AppConfigService } from '../config/app-config.service';
import { migrations } from './migrations';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly connection: DatabaseSync;

  constructor(@Inject(AppConfigService) config: AppConfigService) {
    mkdirSync(dirname(config.databasePath), { recursive: true });
    this.connection = new DatabaseSync(config.databasePath);
    this.connection.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
    this.migrate();
  }

  transaction<T>(operation: () => T): T {
    this.connection.exec('BEGIN IMMEDIATE');
    try {
      const result = operation();
      this.connection.exec('COMMIT');
      return result;
    } catch (error) {
      this.connection.exec('ROLLBACK');
      throw error;
    }
  }

  onModuleDestroy() {
    this.connection.close();
  }

  private migrate() {
    const row = this.connection.prepare('PRAGMA user_version').get() as unknown as { user_version: number };
    for (const migration of migrations.filter(({ version }) => version > row.user_version)) {
      this.transaction(() => {
        this.connection.exec(migration.sql);
      });
    }
  }
}
