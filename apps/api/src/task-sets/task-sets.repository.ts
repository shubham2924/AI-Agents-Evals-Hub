import { Inject, Injectable } from '@nestjs/common';
import type { ScorerType, Task, TaskSet } from '@agent-evals/shared';
import { DatabaseService } from '../common/database/database.service';
import type { CreateTaskSetDto } from './dto/create-task-set.dto';

interface TaskSetRow {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

interface TaskRow {
  id: string;
  task_set_id: string;
  name: string;
  prompt: string;
  scorer_type: string;
  expected: string;
  weight: number;
}

@Injectable()
export class TaskSetsRepository {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  findAll(): TaskSet[] {
    const taskSets = this.database.connection
      .prepare(
        `
      SELECT id, name, description, created_at
      FROM task_sets
      ORDER BY created_at DESC, id ASC
    `,
      )
      .all() as unknown as TaskSetRow[];
    const tasks = this.database.connection
      .prepare(
        `
      SELECT id, task_set_id, name, prompt, scorer_type, expected, weight
      FROM tasks
      ORDER BY rowid ASC
    `,
      )
      .all() as unknown as TaskRow[];
    const tasksBySet = groupTasks(tasks);
    return taskSets.map((row) => mapTaskSet(row, tasksBySet.get(row.id) ?? []));
  }

  findById(id: string): TaskSet | null {
    const row = this.database.connection
      .prepare(
        `
      SELECT id, name, description, created_at
      FROM task_sets
      WHERE id = ?
    `,
      )
      .get(id) as unknown as TaskSetRow | undefined;
    if (!row) return null;
    return mapTaskSet(row, this.findTasks(id));
  }

  findTaskById(id: string): Task | null {
    const row = this.database.connection
      .prepare(
        `
      SELECT id, task_set_id, name, prompt, scorer_type, expected, weight
      FROM tasks
      WHERE id = ?
    `,
      )
      .get(id) as unknown as TaskRow | undefined;
    return row ? mapTask(row) : null;
  }

  create(input: CreateTaskSetDto): TaskSet {
    const taskSetId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    this.database.transaction(() => {
      this.database.connection
        .prepare(
          `
        INSERT INTO task_sets (id, name, description, created_at)
        VALUES (?, ?, ?, ?)
      `,
        )
        .run(taskSetId, input.name, input.description, createdAt);
      const insertTask = this.database.connection.prepare(`
        INSERT INTO tasks (id, task_set_id, name, prompt, scorer_type, expected, weight)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const task of input.tasks) {
        insertTask.run(
          crypto.randomUUID(),
          taskSetId,
          task.name,
          task.prompt,
          task.scorerType,
          task.expected,
          task.weight,
        );
      }
    });
    return this.findById(taskSetId)!;
  }

  private findTasks(taskSetId: string): Task[] {
    const rows = this.database.connection
      .prepare(
        `
      SELECT id, task_set_id, name, prompt, scorer_type, expected, weight
      FROM tasks
      WHERE task_set_id = ?
      ORDER BY rowid ASC
    `,
      )
      .all(taskSetId) as unknown as TaskRow[];
    return rows.map(mapTask);
  }
}

function groupTasks(rows: TaskRow[]) {
  const grouped = new Map<string, Task[]>();
  for (const row of rows)
    grouped.set(row.task_set_id, [...(grouped.get(row.task_set_id) ?? []), mapTask(row)]);
  return grouped;
}

function mapTaskSet(row: TaskSetRow, tasks: Task[]): TaskSet {
  return { id: row.id, name: row.name, description: row.description, createdAt: row.created_at, tasks };
}

function mapTask(row: TaskRow): Task {
  if (!['exact', 'contains', 'regex', 'json'].includes(row.scorer_type)) {
    throw new Error(`Task ${row.id} has an unsupported scorer type.`);
  }
  return {
    id: row.id,
    taskSetId: row.task_set_id,
    name: row.name,
    prompt: row.prompt,
    scorerType: row.scorer_type as ScorerType,
    expected: row.expected,
    weight: row.weight,
  };
}
