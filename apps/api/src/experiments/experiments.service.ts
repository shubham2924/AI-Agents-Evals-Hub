import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { ExperimentDetail, ExperimentSummary, RunDetail } from '@agent-evals/shared';
import { AgentConfigsService } from '../agent-configs/agent-configs.service';
import { compareRuns } from '../evaluation/comparison';
import { TaskSetsService } from '../task-sets/task-sets.service';
import type { CreateExperimentDto } from './dto/create-experiment.dto';
import { ExperimentsRepository } from './experiments.repository';

@Injectable()
export class ExperimentsService {
  constructor(
    @Inject(ExperimentsRepository) private readonly repository: ExperimentsRepository,
    @Inject(TaskSetsService) private readonly taskSets: TaskSetsService,
    @Inject(AgentConfigsService) private readonly configs: AgentConfigsService,
  ) {}

  list(): ExperimentSummary[] {
    return this.repository.findAll();
  }

  get(id: string): ExperimentSummary {
    const experiment = this.repository.findById(id);
    if (!experiment) throw new NotFoundException('Experiment not found.');
    return experiment;
  }

  getDetail(id: string): ExperimentDetail {
    const experiment = this.get(id);
    const runs = this.repository.findRuns(id);
    const scoredRuns = runs.flatMap((run) =>
      run.score === null
        ? []
        : [
            {
              taskId: run.taskId,
              configId: run.configId,
              repetition: run.repetition,
              score: run.score,
            },
          ],
    );
    return {
      ...experiment,
      taskSet: this.taskSets.get(experiment.taskSetId),
      baselineConfig: this.configs.get(experiment.baselineConfigId),
      candidateConfig: this.configs.get(experiment.candidateConfigId),
      runs,
      comparison: compareRuns(scoredRuns, experiment.baselineConfigId, experiment.candidateConfigId),
    };
  }

  getRun(id: string): RunDetail {
    const run = this.repository.findRunById(id);
    if (!run) throw new NotFoundException('Run not found.');
    const task = this.taskSets.getTask(run.taskId);
    return { ...run, task, config: this.configs.get(run.configId) };
  }

  create(input: CreateExperimentDto): ExperimentSummary {
    if (input.baselineConfigId === input.candidateConfigId) {
      throw new BadRequestException('Baseline and candidate configurations must be different.');
    }
    this.taskSets.get(input.taskSetId);
    this.configs.get(input.baselineConfigId);
    this.configs.get(input.candidateConfigId);
    return this.repository.create(input);
  }
}
