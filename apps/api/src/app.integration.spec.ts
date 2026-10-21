import 'reflect-metadata';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { SampleDataSeeder } from './seed/sample-data.seeder';

describe('Agent Evals API', () => {
  let app: NestExpressApplication;
  let temporaryDirectory: string;
  const originalDatabasePath = process.env.DATABASE_PATH;

  beforeAll(async () => {
    temporaryDirectory = mkdtempSync(resolve(tmpdir(), 'agent-evals-api-'));
    process.env.DATABASE_PATH = resolve(temporaryDirectory, 'test.db');
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app);
    app.get(SampleDataSeeder).seed();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(temporaryDirectory, { recursive: true, force: true });
    if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
    else process.env.DATABASE_PATH = originalDatabasePath;
  });

  it('serves the seeded workspace through all dashboard endpoints', async () => {
    const [health, taskSets, configs, experiments] = await Promise.all([
      request(app.getHttpServer()).get('/api/health').expect(200),
      request(app.getHttpServer()).get('/api/task-sets').expect(200),
      request(app.getHttpServer()).get('/api/configs').expect(200),
      request(app.getHttpServer()).get('/api/experiments').expect(200),
    ]);
    expect(health.body.status).toBe('ok');
    expect(taskSets.body).toHaveLength(1);
    expect(configs.body).toHaveLength(2);
    expect(experiments.body).toHaveLength(1);
    expect(health.headers['x-content-type-options']).toBe('nosniff');
  });

  it('stores SQL metacharacters as data instead of executing them', async () => {
    const maliciousName = "Support'); DROP TABLE task_sets; --";
    const created = await request(app.getHttpServer())
      .post('/api/task-sets')
      .send({
        name: maliciousName,
        description: 'Parameterization regression test',
        tasks: [{ name: 'Safe task', prompt: 'Reply yes.', scorerType: 'exact', expected: 'yes', weight: 1 }],
      })
      .expect(201);
    expect(created.body.name).toBe(maliciousName);
    const taskSets = await request(app.getHttpServer()).get('/api/task-sets').expect(200);
    expect(taskSets.body).toHaveLength(2);
  });

  it('rejects unknown fields, unsafe skill paths, and unsafe regular expressions', async () => {
    await request(app.getHttpServer())
      .post('/api/experiments')
      .send({
        name: 'Unknown field',
        taskSetId: 'support-triage-v1',
        baselineConfigId: 'baseline-general',
        candidateConfigId: 'candidate-support-skill',
        runnerType: 'demo',
        repetitions: 1,
        unexpected: true,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/configs')
      .send({
        name: 'Unsafe config',
        description: '',
        provider: 'openai-api',
        model: 'gpt-5.4-mini',
        skills: ['../../private'],
        tools: [],
        memoryEnabled: false,
        systemPrompt: '',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/api/task-sets')
      .send({
        name: 'Unsafe regex',
        description: '',
        tasks: [{ name: 'Regex task', prompt: 'Test', scorerType: 'regex', expected: '(a+)+$', weight: 1 }],
      })
      .expect(400);
  });

  it('rejects experiments that compare a configuration with itself', async () => {
    await request(app.getHttpServer())
      .post('/api/experiments')
      .send({
        name: 'Invalid comparison',
        taskSetId: 'support-triage-v1',
        baselineConfigId: 'baseline-general',
        candidateConfigId: 'baseline-general',
        runnerType: 'demo',
        repetitions: 1,
      })
      .expect(400);
  });

  it('executes and scores a complete demo experiment', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/experiments')
      .send({
        name: 'Integration demo',
        taskSetId: 'support-triage-v1',
        baselineConfigId: 'baseline-general',
        candidateConfigId: 'candidate-support-skill',
        runnerType: 'demo',
        repetitions: 1,
      })
      .expect(201);
    await request(app.getHttpServer()).post(`/api/experiments/${created.body.id}/run`).expect(201);

    const detail = await waitForCompletedExperiment(app, created.body.id);
    expect(detail.status).toBe('completed');
    expect(detail.runs).toHaveLength(10);
    expect(detail.comparison.sampleCount).toBe(5);
    expect(detail.runs.every((run: { status: string }) => ['passed', 'failed'].includes(run.status))).toBe(
      true,
    );
  });
});

async function waitForCompletedExperiment(app: NestExpressApplication, id: string) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const response = await request(app.getHttpServer()).get(`/api/experiments/${id}`).expect(200);
    if (response.body.status !== 'running') return response.body;
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 25));
  }
  throw new Error('Demo experiment did not finish within the test timeout.');
}
