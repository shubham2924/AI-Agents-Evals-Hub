import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { ScorerType } from '@agent-evals/shared';
import { Trim } from '../../common/validation/decorators';

export class CreateTaskDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(20_000)
  prompt!: string;

  @IsIn(['exact', 'contains', 'regex', 'json'] satisfies ScorerType[])
  scorerType!: ScorerType;

  @Trim()
  @IsString()
  @MaxLength(10_000)
  expected!: string;

  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(100)
  weight = 1;
}

export class CreateTaskSetDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Trim()
  @IsString()
  @MaxLength(1_000)
  description = '';

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateTaskDto)
  tasks!: CreateTaskDto[];
}
