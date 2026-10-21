import { Injectable } from '@nestjs/common';
import { homedir } from 'node:os';
import { isAbsolute, resolve } from 'node:path';
import { projectRoot } from '../../paths';

@Injectable()
export class AppConfigService {
  readonly port = parseInteger('PORT', process.env.PORT, 3000, 1, 65_535);
  readonly runConcurrency = parseInteger('RUN_CONCURRENCY', process.env.RUN_CONCURRENCY, 2, 1, 8);
  readonly hermesTimeoutMs = parseInteger(
    'HERMES_TIMEOUT_MS',
    process.env.HERMES_TIMEOUT_MS,
    300_000,
    1_000,
    1_800_000,
  );
  readonly databasePath = resolvePath(process.env.DATABASE_PATH?.trim() || 'data/agent-evals.db');
  readonly hermesBinary = process.env.HERMES_BIN?.trim() || 'hermes';
  readonly hermesProfilesRoot =
    process.env.HERMES_EVALS_PROFILE_ROOT?.trim() || resolve(homedir(), '.hermes', 'profiles');
  readonly keepHermesProfiles = process.env.KEEP_HERMES_PROFILES === 'true';
  readonly openAiApiKey = process.env.OPENAI_API_KEY?.trim() || null;

  childProcessEnvironment(hermesHome: string): NodeJS.ProcessEnv {
    return { ...process.env, HERMES_HOME: hermesHome };
  }
}

function parseInteger(
  name: string,
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function resolvePath(path: string) {
  return isAbsolute(path) ? path : resolve(projectRoot, path);
}
