import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Max, Min, ValidateNested } from 'class-validator';

export class CreateExperimentDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() taskSetId!: string;
  @IsString() baselineConfigId!: string;
  @IsString() candidateConfigId!: string;
  @IsIn(['demo', 'hermes']) runnerType!: 'demo' | 'hermes';
  @IsInt() @Min(1) @Max(20) repetitions!: number;
}

export class CreateTaskDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() prompt!: string;
  @IsIn(['exact', 'contains', 'regex', 'json']) scorerType!: string;
  @IsString() expected!: string;
  @IsNumber() @Min(0) @Max(100) weight = 1;
}
export class CreateTaskSetDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() description = '';
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => CreateTaskDto) tasks!: CreateTaskDto[];
}
export class CreateConfigDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsString() description = '';
  @IsString() provider!: string;
  @IsString() model!: string;
  @IsArray() @IsString({ each: true }) skills: string[] = [];
  @IsArray() @IsString({ each: true }) tools: string[] = [];
  @IsBoolean() memoryEnabled = false;
  @IsString() systemPrompt = '';
}
