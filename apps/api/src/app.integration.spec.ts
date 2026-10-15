import 'reflect-metadata';
import { TestingModule, Test } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppController } from './app.controller';
import { AppModule } from './app.module';
import { DatabaseService } from './database';
import { seed } from './seed';

describe('AppModule dependency wiring', () => {
  let module: TestingModule;
  let controller: AppController;
  let temporaryDirectory: string;
  const originalDatabasePath = process.env.DATABASE_PATH;

  beforeAll(async () => {
    temporaryDirectory = mkdtempSync(resolve(tmpdir(), 'agent-evals-api-'));
    process.env.DATABASE_PATH = resolve(temporaryDirectory, 'test.db');
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    seed(module.get(DatabaseService));
    controller = module.get(AppController);
  });

  afterAll(async () => {
    await module.close();
    rmSync(temporaryDirectory, { recursive: true, force: true });
    if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = originalDatabasePath;
  });

  it('injects services and serves all initial dashboard collections', () => {
    expect(controller.taskSets()).toHaveLength(1);
    expect(controller.configs()).toHaveLength(2);
    expect(controller.experiments()).toHaveLength(1);
  });
});
