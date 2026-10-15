import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { DatabaseService } from './database';
import { seed } from './seed';
import { projectRoot } from './paths';

// Always load the repository's .env, even when npm is started from another directory.
loadEnv({ path: resolve(projectRoot, '.env'), quiet: true });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  seed(app.get(DatabaseService));
  const webDist = resolve(projectRoot, 'apps/web/dist');
  if (existsSync(webDist)) {
    app.useStaticAssets(webDist, { index: false });
    app.getHttpAdapter().getInstance().get(/^(?!\/api(?:\/|$)).*/, (_request: unknown, response: { sendFile(path: string): void }) => response.sendFile(resolve(webDist, 'index.html')));
  }
  await app.listen(Number(process.env.PORT ?? 3000), '127.0.0.1');
  console.log(`Agent Evals API listening on http://localhost:${process.env.PORT ?? 3000}`);
}
void bootstrap();
