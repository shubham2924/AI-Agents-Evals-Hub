import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  SAFE_IDENTIFIER_PATTERN,
  SAFE_SLUG_PATTERN,
  Trim,
  TrimStringArray,
} from '../../common/validation/decorators';

export class CreateAgentConfigDto {
  @Trim()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @Trim()
  @IsString()
  @MaxLength(1_000)
  description = '';

  @Trim()
  @IsString()
  @MaxLength(128)
  @Matches(SAFE_IDENTIFIER_PATTERN)
  provider!: string;

  @Trim()
  @IsString()
  @MaxLength(128)
  @Matches(SAFE_IDENTIFIER_PATTERN)
  model!: string;

  @TrimStringArray()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @Matches(SAFE_SLUG_PATTERN, { each: true })
  skills: string[] = [];

  @TrimStringArray()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  @Matches(SAFE_SLUG_PATTERN, { each: true })
  tools: string[] = [];

  @IsBoolean()
  memoryEnabled = false;

  @Trim()
  @IsString()
  @MaxLength(20_000)
  systemPrompt = '';
}
