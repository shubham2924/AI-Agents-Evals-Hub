import { Inject, Injectable } from '@nestjs/common';
import type { AgentConfig } from '@agent-evals/shared';
import { DatabaseService } from '../common/database/database.service';
import { parseStringArray } from '../common/persistence/json';
import type { CreateAgentConfigDto } from './dto/create-agent-config.dto';

interface AgentConfigRow {
  id: string;
  name: string;
  description: string;
  provider: string;
  model: string;
  skills_json: string;
  tools_json: string;
  memory_enabled: number;
  system_prompt: string;
  created_at: string;
}

const selectColumns = `
  id, name, description, provider, model, skills_json, tools_json,
  memory_enabled, system_prompt, created_at
`;

@Injectable()
export class AgentConfigsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  findAll(): AgentConfig[] {
    const rows = this.database.connection
      .prepare(
        `
      SELECT ${selectColumns}
      FROM agent_configs
      ORDER BY created_at ASC, id ASC
    `,
      )
      .all() as unknown as AgentConfigRow[];
    return rows.map(mapAgentConfig);
  }

  findById(id: string): AgentConfig | null {
    const row = this.database.connection
      .prepare(
        `
      SELECT ${selectColumns}
      FROM agent_configs
      WHERE id = ?
    `,
      )
      .get(id) as unknown as AgentConfigRow | undefined;
    return row ? mapAgentConfig(row) : null;
  }

  create(input: CreateAgentConfigDto): AgentConfig {
    const id = crypto.randomUUID();
    this.database.connection
      .prepare(
        `
      INSERT INTO agent_configs (
        id, name, description, provider, model, skills_json, tools_json,
        memory_enabled, system_prompt, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        id,
        input.name,
        input.description,
        input.provider,
        input.model,
        JSON.stringify(input.skills),
        JSON.stringify(input.tools),
        Number(input.memoryEnabled),
        input.systemPrompt,
        new Date().toISOString(),
      );
    return this.findById(id)!;
  }
}

function mapAgentConfig(row: AgentConfigRow): AgentConfig {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    provider: row.provider,
    model: row.model,
    skills: parseStringArray(row.skills_json, `skills for agent configuration ${row.id}`),
    tools: parseStringArray(row.tools_json, `tools for agent configuration ${row.id}`),
    memoryEnabled: row.memory_enabled === 1,
    systemPrompt: row.system_prompt,
    createdAt: row.created_at,
  };
}
