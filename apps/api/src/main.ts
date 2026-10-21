import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { AppConfigService } from './common/config/app-config.service';
import { configureApp } from './configure-app';
import { projectRoot } from './paths';
import { SampleDataSeeder } from './seed/sample-data.seeder';

// Always load the repository's .env, even when npm is started from another directory.
loadEnv({ path: resolve(projectRoot, '.env'), quiet: true });

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(AppConfigService);
  configureApp(app);
  app.enableShutdownHooks();
  app.get(SampleDataSeeder).seed();
  const webDist = resolve(projectRoot, 'apps/web/dist');
  if (existsSync(webDist)) {
    app.useStaticAssets(webDist, { index: false });
    app
      .getHttpAdapter()
      .getInstance()
      .get(/^(?!\/api(?:\/|$)).*/, (_request: unknown, response: { sendFile(path: string): void }) =>
        response.sendFile(resolve(webDist, 'index.html')),
      );
  }
  await app.listen(config.port, '127.0.0.1');
  Logger.log(`Agent Evals API listening on http://localhost:${config.port}`, 'Bootstrap');
}
void bootstrap().catch((error: unknown) => {
  Logger.error(error instanceof Error ? error.stack : String(error), undefined, 'Bootstrap');
  process.exitCode = 1;
});
