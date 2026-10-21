import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AgentConfig, Task, TraceEvent } from '@agent-evals/shared';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, relative, resolve } from 'node:path';
import { AppConfigService } from '../common/config/app-config.service';
import { SAFE_SLUG_PATTERN } from '../common/validation/decorators';
import { projectRoot } from '../paths';
import type { EvaluationRunner, EvaluationRunInput, RunnerResult } from './runner.types';

interface HermesResultEvent {
  type: 'result';
  text?: unknown;
  error?: unknown;
  exit_code?: unknown;
  duration_ms?: unknown;
  tokens?: { input?: unknown; output?: unknown };
}

const MAX_STREAM_LINE_LENGTH = 1_000_000;
const MAX_DIAGNOSTIC_LENGTH = 100_000;
const MAX_TRACE_CONTENT_LENGTH = 50_000;
const MAX_TRACE_EVENTS = 500;
const MAX_MODEL_OUTPUT_LENGTH = 1_000_000;
const MODEL_PRICES_PER_MILLION: Readonly<Record<string, readonly [number, number]>> = {
  'gpt-5.4-mini': [0.75, 4.5],
};

@Injectable()
export class HermesRunnerService implements EvaluationRunner {
  private readonly logger = new Logger(HermesRunnerService.name);

  constructor(@Inject(AppConfigService) private readonly config: AppConfigService) {}

  async run({ experimentId, runId, task, config }: EvaluationRunInput): Promise<RunnerResult> {
    const startedAt = Date.now();
    if (config.provider === 'openai-api' && !this.config.openAiApiKey) {
      return failedResult(
        'OPENAI_API_KEY is missing. Copy .env.example to .env, add your key, and restart npm run dev.',
        startedAt,
        task,
      );
    }

    const hermesHome = resolve(this.config.hermesProfilesRoot, `agent-evals-${experimentId}-${runId}`);
    const trace: TraceEvent[] = [
      {
        at: new Date().toISOString(),
        type: 'prompt',
        title: task.name,
        content: task.prompt,
      },
    ];

    try {
      this.prepareProfile(hermesHome, config);
      const processResult = await runHermesProcess({
        command: resolveHermesCommand(this.config.hermesBinary),
        args: buildArguments(task, config),
        environment: this.config.childProcessEnvironment(hermesHome),
        timeoutMs: this.config.hermesTimeoutMs,
        trace,
      });
      const safeError = processResult.error
        ? redactSecrets(processResult.error, this.config.openAiApiKey)
        : null;
      return {
        ...processResult,
        error: safeError,
        latencyMs: processResult.latencyMs || Date.now() - startedAt,
        estimatedCostUsd: estimateCost(config.model, processResult.inputTokens, processResult.outputTokens),
        trace,
      };
    } catch (error) {
      const missingCommand = error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT';
      const message = missingCommand
        ? 'Hermes executable was not found. Set HERMES_BIN in .env to the absolute path printed by "which hermes", then restart the app.'
        : redactSecrets(error instanceof Error ? error.message : String(error), this.config.openAiApiKey);
      appendTrace(trace, {
        at: new Date().toISOString(),
        type: 'error',
        title: 'Hermes failed',
        content: message,
      });
      return failedResult(message, startedAt, task, trace);
    } finally {
      if (!this.config.keepHermesProfiles) this.removeProfile(hermesHome);
    }
  }

  private prepareProfile(hermesHome: string, config: AgentConfig) {
    mkdirSync(hermesHome, { recursive: true });
    writeFileSync(resolve(hermesHome, 'SOUL.md'), `${config.systemPrompt.trim()}\n`, { mode: 0o600 });
    writeFileSync(
      resolve(hermesHome, 'config.yaml'),
      `memory:\n  memory_enabled: ${config.memoryEnabled}\n  user_profile_enabled: ${config.memoryEnabled}\n`,
      { mode: 0o600 },
    );
    for (const skill of config.skills) this.copySkill(hermesHome, skill);
  }

  private copySkill(hermesHome: string, skill: string) {
    if (!SAFE_SLUG_PATTERN.test(skill)) throw new Error(`Unsafe skill identifier: ${skill}`);
    const skillsRoot = resolve(projectRoot, 'sample', 'skills');
    const source = resolve(skillsRoot, skill);
    const sourceRelativePath = relative(skillsRoot, source);
    if (sourceRelativePath.startsWith('..') || isAbsolute(sourceRelativePath)) {
      throw new Error(`Skill path escapes the configured skills directory: ${skill}`);
    }
    if (!existsSync(source)) throw new Error(`Configured skill is not installed: ${skill}`);
    const destination = resolve(hermesHome, 'skills', skill);
    mkdirSync(destination, { recursive: true });
    cpSync(source, destination, { recursive: true });
  }

  private removeProfile(hermesHome: string) {
    try {
      rmSync(hermesHome, { recursive: true, force: true });
    } catch (error) {
      this.logger.warn(`Could not remove temporary Hermes profile ${hermesHome}: ${String(error)}`);
    }
  }
}

function buildArguments(task: Task, config: AgentConfig) {
  const args = [
    'chat',
    '--oneshot',
    '--query',
    task.prompt,
    '--format',
    'stream-json',
    '--source',
    'agent-evals',
    '--provider',
    config.provider,
    '--model',
    config.model,
    '--max-turns',
    '20',
  ];
  if (config.tools.length > 0) args.push('--toolsets', config.tools.join(','));
  if (config.skills.length > 0) args.push('--skills', config.skills.join(','));
  return args;
}

function resolveHermesCommand(configured: string) {
  if (configured !== 'hermes') return configured;
  const standardUserInstall = resolve(homedir(), '.local', 'bin', 'hermes');
  return existsSync(standardUserInstall) ? standardUserInstall : configured;
}

function runHermesProcess(input: {
  command: string;
  args: string[];
  environment: NodeJS.ProcessEnv;
  timeoutMs: number;
  trace: TraceEvent[];
}): Promise<Omit<RunnerResult, 'trace'>> {
  return new Promise((resolveProcess, reject) => {
    const child = spawn(input.command, input.args, {
      env: input.environment,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdoutBuffer = '';
    let stderr = '';
    let finalEvent: HermesResultEvent | null = null;
    let timedOut = false;
    const forceKillTimer = { current: undefined as NodeJS.Timeout | undefined };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      forceKillTimer.current = setTimeout(() => child.kill('SIGKILL'), 5_000);
    }, input.timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf8');
      if (stdoutBuffer.length > MAX_STREAM_LINE_LENGTH && !stdoutBuffer.includes('\n')) {
        child.kill('SIGTERM');
        return;
      }
      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) finalEvent = processHermesLine(line, input.trace) ?? finalEvent;
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr = appendBounded(stderr, chunk.toString('utf8'), MAX_DIAGNOSTIC_LENGTH);
    });
    child.once('error', reject);
    child.once('close', (code) => {
      clearTimeout(timeout);
      if (forceKillTimer.current) clearTimeout(forceKillTimer.current);
      if (stdoutBuffer.trim()) finalEvent = processHermesLine(stdoutBuffer, input.trace) ?? finalEvent;
      const output = truncate(asString(finalEvent?.text), MAX_MODEL_OUTPUT_LENGTH);
      if (output)
        appendTrace(input.trace, {
          at: new Date().toISOString(),
          type: 'response',
          title: 'Agent response',
          content: truncate(output, MAX_TRACE_CONTENT_LENGTH),
        });
      const exitCode = asNumber(finalEvent?.exit_code, code ?? 1);
      const error = timedOut
        ? `Hermes exceeded the ${input.timeoutMs} ms timeout.`
        : exitCode === 0
          ? null
          : asString(finalEvent?.error) || stderr.trim() || `Hermes exited with code ${exitCode}.`;
      resolveProcess({
        output,
        latencyMs: asNumber(finalEvent?.duration_ms, 0),
        inputTokens: asNumber(finalEvent?.tokens?.input, 0),
        outputTokens: asNumber(finalEvent?.tokens?.output, 0),
        estimatedCostUsd: 0,
        exitCode,
        error,
      });
    });
  });
}

function processHermesLine(line: string, trace: TraceEvent[]): HermesResultEvent | null {
  if (!line.trim()) return null;
  let event: Record<string, unknown>;
  try {
    const parsed = JSON.parse(line) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    event = parsed as Record<string, unknown>;
  } catch {
    return null;
  }
  const at = safeTimestamp(event.timestamp);
  if (event.type === 'system')
    appendTrace(trace, {
      at,
      type: 'system',
      title: `Hermes · ${asString(event.model) || 'initialized'}`,
      content: truncate(asString(event.session_id), MAX_TRACE_CONTENT_LENGTH),
    });
  if (event.type === 'tool_use')
    appendTrace(trace, {
      at,
      type: 'tool',
      title: `Tool: ${asString(event.name) || 'unknown'}`,
      content: truncate(JSON.stringify(event.input ?? {}, null, 2), MAX_TRACE_CONTENT_LENGTH),
    });
  if (event.type === 'tool_result')
    appendTrace(trace, {
      at,
      type: event.is_error ? 'error' : 'tool',
      title: `${asString(event.name) || 'Tool'} result · ${asNumber(event.duration_ms, 0)} ms`,
      content: truncate(asString(event.output), MAX_TRACE_CONTENT_LENGTH),
    });
  return event.type === 'result' ? (event as unknown as HermesResultEvent) : null;
}

function estimateCost(model: string, inputTokens: number, outputTokens: number) {
  const price = MODEL_PRICES_PER_MILLION[model];
  return price ? (inputTokens * price[0] + outputTokens * price[1]) / 1_000_000 : 0;
}

function failedResult(
  message: string,
  startedAt: number,
  task: Task,
  existingTrace?: TraceEvent[],
): RunnerResult {
  const now = new Date().toISOString();
  return {
    output: '',
    latencyMs: Date.now() - startedAt,
    inputTokens: 0,
    outputTokens: 0,
    estimatedCostUsd: 0,
    exitCode: 1,
    error: message,
    trace: existingTrace ?? [
      { at: now, type: 'prompt', title: task.name, content: task.prompt },
      { at: now, type: 'error', title: 'Setup required', content: message },
    ],
  };
}

function safeTimestamp(value: unknown) {
  const date = new Date(typeof value === 'number' || typeof value === 'string' ? value : Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function asString(value: unknown) {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

function asNumber(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function truncate(value: string, maximum: number) {
  return value.length <= maximum ? value : `${value.slice(0, maximum)}\n… truncated`;
}

function appendBounded(current: string, next: string, maximum: number) {
  return truncate(current + next, maximum);
}

function appendTrace(trace: TraceEvent[], event: TraceEvent) {
  if (trace.length < MAX_TRACE_EVENTS) {
    trace.push(event);
    return;
  }
  if (trace.length === MAX_TRACE_EVENTS) {
    trace.push({
      at: new Date().toISOString(),
      type: 'system',
      title: 'Trace truncated',
      content: `Only the first ${MAX_TRACE_EVENTS} events were retained.`,
    });
  }
}

function redactSecrets(value: string, apiKey: string | null) {
  return apiKey ? value.replaceAll(apiKey, '[REDACTED]') : value;
}
