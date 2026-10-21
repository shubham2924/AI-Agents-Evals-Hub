import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { createValidationPipe } from '../common/validation/validation-pipe';
import { CreateTaskSetDto } from './dto/create-task-set.dto';
import { TaskSetsService } from './task-sets.service';

@Controller('api/task-sets')
export class TaskSetsController {
  constructor(@Inject(TaskSetsService) private readonly taskSets: TaskSetsService) {}

  @Get()
  list() {
    return this.taskSets.list();
  }

  @Post()
  create(@Body(createValidationPipe(CreateTaskSetDto)) input: CreateTaskSetDto) {
    return this.taskSets.create(input);
  }
}
