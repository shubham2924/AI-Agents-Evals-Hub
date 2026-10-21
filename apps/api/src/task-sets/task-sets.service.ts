import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Task, TaskSet } from '@agent-evals/shared';
import safeRegex from 'safe-regex2';
import type { CreateTaskSetDto } from './dto/create-task-set.dto';
import { TaskSetsRepository } from './task-sets.repository';

@Injectable()
export class TaskSetsService {
  constructor(@Inject(TaskSetsRepository) private readonly repository: TaskSetsRepository) {}

  list(): TaskSet[] {
    return this.repository.findAll();
  }

  get(id: string): TaskSet {
    const taskSet = this.repository.findById(id);
    if (!taskSet) throw new NotFoundException('Task set not found.');
    return taskSet;
  }

  getTask(id: string): Task {
    const task = this.repository.findTaskById(id);
    if (!task) throw new NotFoundException('Task not found.');
    return task;
  }

  create(input: CreateTaskSetDto): TaskSet {
    for (const task of input.tasks) validateExpectedValue(task.scorerType, task.expected);
    return this.repository.create(input);
  }
}

function validateExpectedValue(scorerType: string, expected: string) {
  if (scorerType === 'regex') {
    try {
      new RegExp(expected, 'i');
    } catch {
      throw new BadRequestException('A task contains an invalid regular expression.');
    }
    if (!safeRegex(expected))
      throw new BadRequestException('A task contains a potentially unsafe regular expression.');
  }
  if (scorerType === 'json') {
    try {
      JSON.parse(expected);
    } catch {
      throw new BadRequestException('A JSON-scored task must contain valid expected JSON.');
    }
  }
  if (scorerType === 'contains' && expected.split('|').some((term) => term.trim() === '')) {
    throw new BadRequestException('Contains-scored tasks cannot include an empty required term.');
  }
}
