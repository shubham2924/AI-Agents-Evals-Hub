import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { createValidationPipe } from '../common/validation/validation-pipe';
import { AgentConfigsService } from './agent-configs.service';
import { CreateAgentConfigDto } from './dto/create-agent-config.dto';

@Controller('api/configs')
export class AgentConfigsController {
  constructor(@Inject(AgentConfigsService) private readonly configs: AgentConfigsService) {}

  @Get()
  list() {
    return this.configs.list();
  }

  @Post()
  create(@Body(createValidationPipe(CreateAgentConfigDto)) input: CreateAgentConfigDto) {
    return this.configs.create(input);
  }
}
