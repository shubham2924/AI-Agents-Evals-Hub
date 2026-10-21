import { Body, Controller, Get, Inject, Param, Post } from '@nestjs/common';
import { IdentifierPipe } from '../common/validation/identifier.pipe';
import { createValidationPipe } from '../common/validation/validation-pipe';
import { CreateExperimentDto } from './dto/create-experiment.dto';
import { ExperimentRunnerService } from './experiment-runner.service';
import { ExperimentsService } from './experiments.service';

@Controller('api')
export class ExperimentsController {
  constructor(
    @Inject(ExperimentsService) private readonly experiments: ExperimentsService,
    @Inject(ExperimentRunnerService) private readonly runner: ExperimentRunnerService,
  ) {}

  @Get('experiments')
  list() {
    return this.experiments.list();
  }

  @Post('experiments')
  create(@Body(createValidationPipe(CreateExperimentDto)) input: CreateExperimentDto) {
    return this.experiments.create(input);
  }

  @Get('experiments/:id')
  detail(@Param('id', IdentifierPipe) id: string) {
    return this.experiments.getDetail(id);
  }

  @Post('experiments/:id/run')
  run(@Param('id', IdentifierPipe) id: string) {
    return this.runner.start(id);
  }

  @Get('runs/:id')
  runDetail(@Param('id', IdentifierPipe) id: string) {
    return this.experiments.getRun(id);
  }
}
