import { Module } from '@nestjs/common';
import { AgentConfigsModule } from '../agent-configs/agent-configs.module';
import { DemoRunnerService } from '../runners/demo-runner.service';
import { HermesRunnerService } from '../runners/hermes-runner.service';
import { TaskSetsModule } from '../task-sets/task-sets.module';
import { ExperimentRunnerService } from './experiment-runner.service';
import { ExperimentsController } from './experiments.controller';
import { ExperimentsRepository } from './experiments.repository';
import { ExperimentsService } from './experiments.service';

@Module({
  imports: [TaskSetsModule, AgentConfigsModule],
  controllers: [ExperimentsController],
  providers: [
    ExperimentsRepository,
    ExperimentsService,
    ExperimentRunnerService,
    DemoRunnerService,
    HermesRunnerService,
  ],
  exports: [ExperimentsRepository, ExperimentsService],
})
export class ExperimentsModule {}
