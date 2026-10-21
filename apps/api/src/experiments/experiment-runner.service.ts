import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import type { AgentConfig, RunnerType, Task } from '@agent-evals/shared';
import { AgentConfigsService } from '../agent-configs/agent-configs.service';
import { AppConfigService } from '../common/config/app-config.service';
import { scoreOutput } from '../evaluation/scoring';
import { DemoRunnerService } from '../runners/demo-runner.service';
import { HermesRunnerService } from '../runners/hermes-runner.service';
import type { EvaluationRunInput, EvaluationRunner, RunnerResult } from '../runners/runner.types';
import { TaskSetsService } from '../task-sets/task-sets.service';
import { ExperimentsRepository } from './experiments.repository';
import { ExperimentsService } from './experiments.service';

type RunJob = EvaluationRunInput;

@Injectable()
export class ExperimentRunnerService {
  private readonly logger = new Logger(ExperimentRunnerService.name);
  private readonly activeExperiments = new Set<string>();

  constructor(
    @Inject(AppConfigService) private readonly appConfig: AppConfigService,
    @Inject(ExperimentsRepository) private readonly repository: ExperimentsRepository,
    @Inject(ExperimentsService) private readonly experiments: ExperimentsService,
    @Inject(TaskSetsService) private readonly taskSets: TaskSetsService,
    @Inject(AgentConfigsService) private readonly agentConfigs: AgentConfigsService,
    @Inject(DemoRunnerService) private readonly demoRunner: DemoRunnerService,
    @Inject(HermesRunnerService) private readonly hermesRunner: HermesRunnerService,
  ) {}

  start(experimentId: string) {
    if (this.activeExperiments.has(experimentId)) {
      throw new ConflictException('Experiment is already running.');
    }
    const experiment = this.experiments.get(experimentId);
    this.activeExperiments.add(experimentId);
    try {
      this.repository.prepareRun(experimentId);
    } catch (error) {
      this.activeExperiments.delete(experimentId);
      throw error;
    }
    void this.execute(experimentId)
      .catch((error: unknown) => {
        this.logger.error(
          `Experiment ${experimentId} failed unexpectedly.`,
          error instanceof Error ? error.stack : String(error),
        );
        this.repository.setStatus(experimentId, 'failed');
      })
      .finally(() => this.activeExperiments.delete(experimentId));
    return { ...experiment, status: 'running' as const, completedAt: null };
  }

  private async execute(experimentId: string) {
    const experiment = this.experiments.get(experimentId);
    const tasks = this.taskSets.get(experiment.taskSetId).tasks;
    const configs = [
      this.agentConfigs.get(experiment.baselineConfigId),
      this.agentConfigs.get(experiment.candidateConfigId),
    ];
    const jobs = createJobs(experimentId, tasks, configs, experiment.repetitions);
    this.repository.insertQueuedRuns(
      jobs.map(({ runId, task, config, repetition }) => ({
        id: runId,
        experimentId,
        taskId: task.id,
        configId: config.id,
        repetition,
      })),
    );

    await runWorkerPool(jobs, this.appConfig.runConcurrency, async (job) => {
      await this.executeRun(experiment.runnerType, job);
    });
    const hasErrors = this.repository.findRuns(experimentId).some(({ status }) => status === 'error');
    this.repository.setStatus(experimentId, hasErrors ? 'failed' : 'completed');
  }

  private async executeRun(runnerType: RunnerType, job: RunJob) {
    this.repository.markRunRunning(job.runId);
    let result: RunnerResult;
    try {
      result = await this.selectRunner(runnerType).run(job);
    } catch (error) {
      this.logger.error(
        `Run ${job.runId} failed unexpectedly.`,
        error instanceof Error ? error.stack : String(error),
      );
      result = unexpectedFailure(job.task);
    }
    if (result.error) {
      this.repository.updateRun(job.runId, {
        ...result,
        status: 'error',
        score: null,
        scorerReason: 'Run failed before scoring.',
      });
      return;
    }
    const score = scoreOutput(job.task.scorerType, job.task.expected, result.output);
    result.trace.push({
      at: new Date().toISOString(),
      type: 'score',
      title: score.score === 1 ? 'Passed' : 'Failed',
      content: score.reason,
    });
    this.repository.updateRun(job.runId, {
      ...result,
      status: score.score === 1 ? 'passed' : 'failed',
      score: score.score,
      scorerReason: score.reason,
    });
  }

  private selectRunner(type: RunnerType): EvaluationRunner {
    return type === 'hermes' ? this.hermesRunner : this.demoRunner;
  }
}

function createJobs(
  experimentId: string,
  tasks: Task[],
  configs: AgentConfig[],
  repetitions: number,
): RunJob[] {
  return tasks.flatMap((task) =>
    configs.flatMap((config) =>
      Array.from({ length: repetitions }, (_, index) => ({
        experimentId,
        runId: crypto.randomUUID(),
        task,
        config,
        repetition: index + 1,
      })),
    ),
  );
}

async function runWorkerPool<T>(jobs: T[], requestedConcurrency: number, execute: (job: T) => Promise<void>) {
  let cursor = 0;
  const worker = async () => {
    while (cursor < jobs.length) {
      const job = jobs[cursor++];
      await execute(job);
    }
  };
  const workerCount = Math.min(requestedConcurrency, jobs.length);
  await Promise.all(Array.from({ length: workerCount }, worker));
}

function unexpectedFailure(task: Task): RunnerResult {
  const message = 'Unexpected runner failure. See the server log for details.';
  const now = new Date().toISOString();
  return {
    output: '',
    latencyMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    exitCode: 1,
    error: message,
    trace: [
      { at: now, type: 'prompt', title: task.name, content: task.prompt },
      { at: now, type: 'error', title: 'Runner failed', content: message },
    ],
  };
}
