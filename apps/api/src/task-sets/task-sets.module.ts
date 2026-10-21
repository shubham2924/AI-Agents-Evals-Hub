import { Module } from '@nestjs/common';
import { TaskSetsController } from './task-sets.controller';
import { TaskSetsRepository } from './task-sets.repository';
import { TaskSetsService } from './task-sets.service';

@Module({
  controllers: [TaskSetsController],
  providers: [TaskSetsRepository, TaskSetsService],
  exports: [TaskSetsService],
})
export class TaskSetsModule {}
