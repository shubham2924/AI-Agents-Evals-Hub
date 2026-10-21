import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { AppModule } from '../app.module';
import { projectRoot } from '../paths';
import { SampleDataSeeder } from './sample-data.seeder';

loadEnv({ path: resolve(projectRoot, '.env'), quiet: true });

async function seed() {
  const application = await NestFactory.createApplicationContext(AppModule, { logger: false });
  application.get(SampleDataSeeder).seed();
  await application.close();
  console.log('Sample data seeded.');
}

void seed();
