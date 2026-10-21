import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AgentConfig } from '@agent-evals/shared';
import { AgentConfigsRepository } from './agent-configs.repository';
import type { CreateAgentConfigDto } from './dto/create-agent-config.dto';

@Injectable()
export class AgentConfigsService {
  constructor(@Inject(AgentConfigsRepository) private readonly repository: AgentConfigsRepository) {}

  list(): AgentConfig[] {
    return this.repository.findAll();
  }

  get(id: string): AgentConfig {
    const config = this.repository.findById(id);
    if (!config) throw new NotFoundException('Agent configuration not found.');
    return config;
  }

  create(input: CreateAgentConfigDto): AgentConfig {
    return this.repository.create(input);
  }
}
