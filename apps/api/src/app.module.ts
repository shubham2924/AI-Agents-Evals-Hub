import { Module } from '@nestjs/common';
import { AgentConfigsModule } from './agent-configs/agent-configs.module';
import { ConfigModule } from './common/config/config.module';
import { DatabaseModule } from './common/database/database.module';
import { ExperimentsModule } from './experiments/experiments.module';
import { HealthModule } from './health/health.module';
import { SampleDataSeeder } from './seed/sample-data.seeder';
import { TaskSetsModule } from './task-sets/task-sets.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    TaskSetsModule,
    AgentConfigsModule,
    ExperimentsModule,
  ],
  providers: [SampleDataSeeder],
})
export class AppModule {}
