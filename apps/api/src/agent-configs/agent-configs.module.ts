import { Module } from '@nestjs/common';
import { AgentConfigsController } from './agent-configs.controller';
import { AgentConfigsRepository } from './agent-configs.repository';
import { AgentConfigsService } from './agent-configs.service';

@Module({
  controllers: [AgentConfigsController],
  providers: [AgentConfigsRepository, AgentConfigsService],
  exports: [AgentConfigsService],
})
export class AgentConfigsModule {}
