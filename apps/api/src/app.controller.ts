import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CreateConfigDto, CreateExperimentDto, CreateTaskSetDto } from './dto';
import { RunnerService } from './runner.service';
import { StoreService } from './store.service';

@Controller('api')
export class AppController {
  constructor(private readonly store: StoreService, private readonly runner: RunnerService) {}
  @Get('health') health() { return { status: 'ok', time: new Date().toISOString() }; }
  @Get('task-sets') taskSets() { return this.store.listTaskSets(); }
  @Post('task-sets') createTaskSet(@Body() input: CreateTaskSetDto) { return this.store.createTaskSet(input); }
  @Get('configs') configs() { return this.store.listConfigs(); }
  @Post('configs') createConfig(@Body() input: CreateConfigDto) { return this.store.createConfig(input); }
  @Get('experiments') experiments() { return this.store.listExperiments(); }
  @Post('experiments') createExperiment(@Body() input: CreateExperimentDto) { return this.store.createExperiment(input); }
  @Get('experiments/:id') experiment(@Param('id') id: string) { return this.store.getExperimentDetail(id); }
  @Post('experiments/:id/run') run(@Param('id') id: string) { return this.runner.start(id); }
  @Get('runs/:id') runDetail(@Param('id') id: string) { return this.store.getRun(id); }
}
