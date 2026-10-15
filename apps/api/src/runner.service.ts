import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import type { AgentConfig, Task, TraceEvent } from '@agent-evals/shared';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { scoreOutput } from './scoring';
import { StoreService } from './store.service';
import { projectRoot } from './paths';

interface RunnerResult {
  output: string; latencyMs: number; inputTokens: number; outputTokens: number;
  estimatedCostUsd: number; exitCode: number; error: string | null; trace: TraceEvent[];
}

@Injectable()
export class RunnerService {
  private readonly logger = new Logger(RunnerService.name);
  private readonly active = new Set<string>();

  constructor(@Inject(StoreService) private readonly store: StoreService) {}

  start(experimentId: string) {
    if (this.active.has(experimentId)) throw new ConflictException('Experiment is already running');
    const experiment = this.store.getExperiment(experimentId);
    this.active.add(experimentId);
    this.store.clearRuns(experimentId);
    this.store.setExperimentStatus(experimentId, 'running');
    void this.execute(experimentId).catch((error) => {
      this.logger.error(`Experiment ${experimentId} failed`, error instanceof Error ? error.stack : String(error));
      this.store.setExperimentStatus(experimentId, 'failed');
    }).finally(() => this.active.delete(experimentId));
    return { ...experiment, status: 'running' as const };
  }

  private async execute(experimentId: string) {
    const experiment = this.store.getExperiment(experimentId);
    const tasks = this.store.getTaskSet(experiment.taskSetId).tasks;
    const configs = [this.store.getConfig(experiment.baselineConfigId), this.store.getConfig(experiment.candidateConfigId)];
    const jobs = tasks.flatMap((task) => configs.flatMap((config) => Array.from({ length: experiment.repetitions }, (_, index) => ({
      id: crypto.randomUUID(), task, config, repetition: index + 1,
    }))));
    for (const job of jobs) this.store.insertQueuedRun({ id: job.id, experimentId, taskId: job.task.id, configId: job.config.id, repetition: job.repetition });

    const concurrency = Math.max(1, Math.min(8, Number(process.env.RUN_CONCURRENCY ?? 2)));
    let cursor = 0;
    const worker = async () => {
      while (cursor < jobs.length) {
        const job = jobs[cursor++];
        await this.executeRun(experiment.runnerType, experimentId, job.id, job.task, job.config, job.repetition);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
    const hasErrors = this.store.listRuns(experimentId).some((run) => run.status === 'error');
    this.store.setExperimentStatus(experimentId, hasErrors ? 'failed' : 'completed');
  }

  private async executeRun(runnerType: string, experimentId: string, runId: string, task: Task, config: AgentConfig, repetition: number) {
    const result = runnerType === 'hermes'
      ? await this.runHermes(experimentId, runId, task, config)
      : await this.runDemo(task, config, repetition);
    if (result.error) {
      this.store.updateRun(runId, { ...result, status: 'error', score: null, scorerReason: 'Run failed before scoring.' });
      return;
    }
    const score = scoreOutput(task.scorerType, task.expected, result.output);
    result.trace.push({ at: new Date().toISOString(), type: 'score', title: score.score === 1 ? 'Passed' : 'Failed', content: score.reason });
    this.store.updateRun(runId, { ...result, status: score.score === 1 ? 'passed' : 'failed', score: score.score, scorerReason: score.reason });
  }

  private async runDemo(task: Task, config: AgentConfig, repetition: number): Promise<RunnerResult> {
    const started = Date.now();
    const reliability = config.skills.length || config.memoryEnabled ? 0.85 : 0.55;
    const passed = deterministicValue(`${task.id}:${config.id}:${repetition}`) < reliability;
    const output = passed ? demoPassingOutput(task) : 'I’m unable to determine that from the information provided.';
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 40 + Math.floor(deterministicValue(config.id + task.id) * 80)));
    const now = new Date().toISOString();
    return {
      output, latencyMs: Date.now() - started, inputTokens: Math.ceil(task.prompt.length / 4), outputTokens: Math.ceil(output.length / 4),
      estimatedCostUsd: 0, exitCode: 0, error: null,
      trace: [
        { at: now, type: 'system', title: 'Demo runner', content: `${config.name} · deterministic local simulation (no model API call)` },
        { at: now, type: 'prompt', title: task.name, content: task.prompt },
        { at: now, type: 'response', title: 'Agent response', content: output },
      ],
    };
  }

  private async runHermes(experimentId: string, runId: string, task: Task, config: AgentConfig): Promise<RunnerResult> {
    const started = Date.now();
    if (config.provider === 'openai-api' && !process.env.OPENAI_API_KEY?.trim()) {
      const message = 'OPENAI_API_KEY is missing. Copy .env.example to .env, add your key, and restart npm run dev.';
      return failedResult(message, started, task);
    }
    // A profile per observation prevents memory/session leakage and permits safe concurrency.
    // A direct child of Hermes' official profiles directory shares the installed
    // Python runtime while keeping this observation's state completely separate.
    const profilesRoot = process.env.HERMES_EVALS_PROFILE_ROOT?.trim()
      || resolve(homedir(), '.hermes', 'profiles');
    const hermesHome = resolve(profilesRoot, `agent-evals-${experimentId}-${runId}`);
    this.prepareHermesProfile(hermesHome, config);
    const args = ['chat', '--oneshot', '--query', task.prompt, '--format', 'stream-json', '--source', 'agent-evals', '--provider', config.provider, '--model', config.model, '--max-turns', '20'];
    if (config.tools.length) args.push('--toolsets', config.tools.join(','));
    if (config.skills.length) args.push('--skills', config.skills.join(','));
    const trace: TraceEvent[] = [{ at: new Date().toISOString(), type: 'prompt', title: task.name, content: task.prompt }];
    try {
      const command = resolveHermesCommand();
      const result = await spawnHermes(command, args, hermesHome, trace);
      return { ...result, latencyMs: result.latencyMs || Date.now() - started, estimatedCostUsd: estimateCost(config.model, result.inputTokens, result.outputTokens), trace };
    } catch (error) {
      const missingCommand = error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT';
      const message = missingCommand
        ? `Hermes executable was not found. Set HERMES_BIN in .env to the absolute path printed by "which hermes", then restart the app.`
        : error instanceof Error ? error.message : String(error);
      trace.push({ at: new Date().toISOString(), type: 'error', title: 'Hermes failed', content: message });
      return { output: '', latencyMs: Date.now() - started, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0, exitCode: 1, error: message, trace };
    } finally {
      if (process.env.KEEP_HERMES_PROFILES !== 'true') {
        try { rmSync(hermesHome, { recursive: true, force: true }); }
        catch (error) { this.logger.warn(`Could not remove temporary Hermes profile ${hermesHome}: ${String(error)}`); }
      }
    }
  }

  private prepareHermesProfile(hermesHome: string, config: AgentConfig) {
    mkdirSync(hermesHome, { recursive: true });
    writeFileSync(resolve(hermesHome, 'SOUL.md'), `${config.systemPrompt.trim()}\n`, { mode: 0o600 });
    writeFileSync(resolve(hermesHome, 'config.yaml'), `memory:\n  memory_enabled: ${config.memoryEnabled}\n  user_profile_enabled: ${config.memoryEnabled}\n`, { mode: 0o600 });
    for (const skill of config.skills) {
      const source = resolve(projectRoot, 'sample/skills', skill);
      if (existsSync(source)) {
        const destination = resolve(hermesHome, 'skills', skill);
        mkdirSync(destination, { recursive: true });
        cpSync(source, destination, { recursive: true });
      }
    }
  }
}

function spawnHermes(command: string, args: string[], hermesHome: string, trace: TraceEvent[]): Promise<Omit<RunnerResult, 'trace'>> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { env: { ...process.env, HERMES_HOME: hermesHome }, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = ''; let final: any;
    const timeout = setTimeout(() => child.kill('SIGTERM'), 5 * 60_000);
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
      const lines = stdout.split('\n'); stdout = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          const at = new Date(event.timestamp ?? Date.now()).toISOString();
          if (event.type === 'system') trace.push({ at, type: 'system', title: `Hermes · ${event.model ?? 'initialized'}`, content: event.session_id ?? '' });
          if (event.type === 'tool_use') trace.push({ at, type: 'tool', title: `Tool: ${event.name}`, content: JSON.stringify(event.input ?? {}, null, 2) });
          if (event.type === 'tool_result') trace.push({ at, type: event.is_error ? 'error' : 'tool', title: `${event.name} result · ${event.duration_ms ?? 0} ms`, content: String(event.output ?? '') });
          if (event.type === 'result') final = event;
        } catch { /* diagnostics remain available in the error field */ }
      }
    });
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      clearTimeout(timeout);
      const output = String(final?.text ?? '');
      if (output) trace.push({ at: new Date().toISOString(), type: 'response', title: 'Agent response', content: output });
      const exitCode = Number(final?.exit_code ?? code ?? 1);
      const error = exitCode === 0 ? null : String(final?.error ?? (stderr.trim() || `Hermes exited with code ${exitCode}`));
      resolvePromise({ output, latencyMs: Number(final?.duration_ms ?? 0), inputTokens: Number(final?.tokens?.input ?? 0), outputTokens: Number(final?.tokens?.output ?? 0), estimatedCostUsd: 0, exitCode, error });
    });
  });
}

function demoPassingOutput(task: Task) {
  if (task.scorerType === 'contains') return task.expected.split('|').join(' — ');
  if (task.scorerType === 'regex') return task.expected.replace(/[\\^$.*+?()[\]{}|]/g, '');
  return task.expected;
}
function deterministicValue(input: string) { let hash = 2166136261; for (const character of input) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); } return (hash >>> 0) / 2 ** 32; }
function resolveHermesCommand() {
  const configured = process.env.HERMES_BIN?.trim() || 'hermes';
  if (configured !== 'hermes') return configured;
  const standardUserInstall = resolve(homedir(), '.local', 'bin', 'hermes');
  return existsSync(standardUserInstall) ? standardUserInstall : configured;
}
function estimateCost(model: string, inputTokens: number, outputTokens: number) {
  // Illustrative October 2026 defaults. Unknown models remain zero rather than implying false precision.
  const prices: Record<string, [number, number]> = { 'gpt-5.4-mini': [0.75, 4.5] };
  const price = prices[model];
  return price ? (inputTokens * price[0] + outputTokens * price[1]) / 1_000_000 : 0;
}

function failedResult(message: string, started: number, task: Task): RunnerResult {
  const now = new Date().toISOString();
  return {
    output: '', latencyMs: Date.now() - started, inputTokens: 0, outputTokens: 0,
    estimatedCostUsd: 0, exitCode: 1, error: message,
    trace: [
      { at: now, type: 'prompt', title: task.name, content: task.prompt },
      { at: now, type: 'error', title: 'Setup required', content: message },
    ],
  };
}
