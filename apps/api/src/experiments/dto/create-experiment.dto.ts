import { IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import type { RunnerType } from '@agent-evals/shared';
import { Trim } from '../../common/validation/decorators';

const RESOURCE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

export class CreateExperimentDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @Matches(RESOURCE_ID_PATTERN)
  taskSetId!: string;

  @IsString()
  @Matches(RESOURCE_ID_PATTERN)
  baselineConfigId!: string;

  @IsString()
  @Matches(RESOURCE_ID_PATTERN)
  candidateConfigId!: string;

  @IsIn(['demo', 'hermes'] satisfies RunnerType[])
  runnerType!: RunnerType;

  @IsInt()
  @Min(1)
  @Max(20)
  repetitions!: number;
}
