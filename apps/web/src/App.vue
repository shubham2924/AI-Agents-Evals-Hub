<script setup lang="ts">
import { useWorkspace } from './composables/use-workspace';

const {
  tab,
  experiments,
  taskSets,
  configs,
  selectedExperiment,
  selectedRun,
  loading,
  error,
  showNewExperiment,
  submitting,
  form,
  completedExperiments,
  totalRuns,
  totalCost,
  openExperiment,
  closeExperiment,
  openRun,
  createExperiment,
  runExperiment,
  clearError,
  percent,
  signedPercent,
  statusClass,
  taskName,
  configName,
  formatDate,
} = useWorkspace();
</script>

<template>
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <span class="brand-mark">E</span>
        <div><strong>Agent Evals</strong><small>Hermes experiments</small></div>
      </div>
      <nav>
        <button
          :class="{ active: tab === 'experiments' }"
          @click="
            tab = 'experiments';
            closeExperiment();
          "
        >
          <span>▦</span> Experiments
        </button>
        <button
          :class="{ active: tab === 'tasks' }"
          @click="
            tab = 'tasks';
            closeExperiment();
          "
        >
          <span>✓</span> Task sets
        </button>
        <button
          :class="{ active: tab === 'configs' }"
          @click="
            tab = 'configs';
            closeExperiment();
          "
        >
          <span>⚙</span> Configurations
        </button>
      </nav>
      <div class="sidebar-note">
        <span class="status-dot"></span>
        <div><strong>Local workspace</strong><small>Data stays on this machine</small></div>
      </div>
    </aside>

    <main>
      <div v-if="error" class="error-banner">{{ error }} <button @click="clearError">Dismiss</button></div>
      <div v-if="loading" class="loading">Loading workspace…</div>

      <template v-else-if="selectedRun">
        <header class="page-header">
          <div>
            <button class="back" @click="selectedRun = null">← Back to experiment</button>
            <h1>{{ selectedRun.task.name }}</h1>
            <p>Run {{ selectedRun.repetition }} · {{ selectedRun.config.name }}</p>
          </div>
          <span class="badge" :class="statusClass(selectedRun.status)">{{ selectedRun.status }}</span>
        </header>
        <section class="run-layout">
          <div class="panel trace-panel">
            <div class="panel-title">
              <h2>Run trace</h2>
              <span>{{ selectedRun.latencyMs }} ms</span>
            </div>
            <div v-for="(event, index) in selectedRun.trace" :key="index" class="trace-event">
              <div class="trace-icon" :class="event.type">
                {{
                  event.type === 'score'
                    ? '✓'
                    : event.type === 'tool'
                      ? '⚙'
                      : event.type === 'error'
                        ? '!'
                        : '·'
                }}
              </div>
              <div>
                <div class="trace-heading">
                  <strong>{{ event.title }}</strong
                  ><small>{{ event.type }}</small>
                </div>
                <pre>{{ event.content }}</pre>
              </div>
            </div>
          </div>
          <aside class="panel run-meta">
            <h2>Scoring</h2>
            <div class="score-big" :class="selectedRun.score === 1 ? 'text-good' : 'text-bad'">
              {{ percent(selectedRun.score) }}
            </div>
            <p>{{ selectedRun.scorerReason }}</p>
            <hr />
            <dl>
              <div>
                <dt>Scorer</dt>
                <dd>{{ selectedRun.task.scorerType }}</dd>
              </div>
              <div>
                <dt>Expected</dt>
                <dd>
                  <code>{{ selectedRun.task.expected }}</code>
                </dd>
              </div>
              <div>
                <dt>Tokens</dt>
                <dd>{{ selectedRun.inputTokens + selectedRun.outputTokens }}</dd>
              </div>
              <div>
                <dt>Est. cost</dt>
                <dd>${{ selectedRun.estimatedCostUsd.toFixed(5) }}</dd>
              </div>
            </dl>
          </aside>
        </section>
      </template>

      <template v-else-if="selectedExperiment">
        <header class="page-header">
          <div>
            <button class="back" @click="closeExperiment">← All experiments</button>
            <div class="title-row">
              <h1>{{ selectedExperiment.name }}</h1>
              <span class="badge" :class="statusClass(selectedExperiment.status)">{{
                selectedExperiment.status
              }}</span>
            </div>
            <p>
              {{ selectedExperiment.taskSet.name }} · {{ selectedExperiment.repetitions }} repetitions ·
              {{ selectedExperiment.runnerType }} runner
            </p>
          </div>
          <button class="primary" :disabled="selectedExperiment.status === 'running'" @click="runExperiment">
            {{ selectedExperiment.status === 'running' ? 'Running…' : 'Run experiment' }}
          </button>
        </header>

        <section class="comparison-grid">
          <div class="panel score-card">
            <div class="eyebrow">Baseline</div>
            <h2>{{ selectedExperiment.baselineConfig.name }}</h2>
            <div class="metric">{{ percent(selectedExperiment.comparison.baselineMean) }}</div>
            <small>{{ selectedExperiment.baselineConfig.model }}</small>
          </div>
          <div class="panel verdict-card" :class="selectedExperiment.comparison.verdict">
            <div class="eyebrow">Observed change</div>
            <div class="delta">{{ signedPercent(selectedExperiment.comparison.absoluteDelta) }}</div>
            <strong>{{
              selectedExperiment.comparison.verdict === 'better'
                ? 'Candidate is better'
                : selectedExperiment.comparison.verdict === 'worse'
                  ? 'Candidate is worse'
                  : 'Result is inconclusive'
            }}</strong>
            <p>
              95% CI {{ signedPercent(selectedExperiment.comparison.confidenceInterval[0]) }} to
              {{ signedPercent(selectedExperiment.comparison.confidenceInterval[1]) }}
            </p>
            <small
              >{{ percent(selectedExperiment.comparison.probabilityOfImprovement) }} probability of
              improvement · n={{ selectedExperiment.comparison.sampleCount }}</small
            >
          </div>
          <div class="panel score-card candidate">
            <div class="eyebrow">Candidate</div>
            <h2>{{ selectedExperiment.candidateConfig.name }}</h2>
            <div class="metric">{{ percent(selectedExperiment.comparison.candidateMean) }}</div>
            <small>{{ selectedExperiment.candidateConfig.model }}</small>
          </div>
        </section>

        <section class="panel task-breakdown">
          <div class="panel-title">
            <div>
              <h2>Performance by task</h2>
              <p>Mean score across repetitions</p>
            </div>
            <div class="legend">
              <span class="baseline-dot"></span>Baseline <span class="candidate-dot"></span>Candidate
            </div>
          </div>
          <div v-for="item in selectedExperiment.comparison.byTask" :key="item.taskId" class="bar-row">
            <div class="bar-label">{{ taskName(item.taskId) }}</div>
            <div class="bars">
              <div class="bar baseline-bar" :style="{ width: `${Math.max(1, item.baseline * 100)}%` }">
                <span>{{ percent(item.baseline) }}</span>
              </div>
              <div class="bar candidate-bar" :style="{ width: `${Math.max(1, item.candidate * 100)}%` }">
                <span>{{ percent(item.candidate) }}</span>
              </div>
            </div>
            <div class="task-delta" :class="item.delta > 0 ? 'text-good' : item.delta < 0 ? 'text-bad' : ''">
              {{ signedPercent(item.delta) }}
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-title">
            <div>
              <h2>Individual runs</h2>
              <p>Open a run to inspect its prompt, response and scoring decision.</p>
            </div>
            <span>{{ selectedExperiment.runs.length }} runs</span>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Configuration</th>
                  <th>Rep</th>
                  <th>Score</th>
                  <th>Latency</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="run in selectedExperiment.runs" :key="run.id">
                  <td>{{ taskName(run.taskId) }}</td>
                  <td>{{ configName(run.configId) }}</td>
                  <td>{{ run.repetition }}</td>
                  <td>{{ percent(run.score) }}</td>
                  <td>{{ run.latencyMs == null ? '—' : `${run.latencyMs} ms` }}</td>
                  <td>
                    <span class="badge small" :class="statusClass(run.status)">{{ run.status }}</span>
                  </td>
                  <td><button class="link" @click="openRun(run.id)">Inspect →</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-else-if="tab === 'experiments'">
        <header class="page-header">
          <div>
            <h1>Experiments</h1>
            <p>Compare agent configurations on the same tasks.</p>
          </div>
          <button class="primary" @click="showNewExperiment = true">New experiment</button>
        </header>
        <section class="stats">
          <div class="panel">
            <small>Completed experiments</small><strong>{{ completedExperiments }}</strong>
          </div>
          <div class="panel">
            <small>Runs in latest experiment</small><strong>{{ totalRuns }}</strong>
          </div>
          <div class="panel">
            <small>Recorded model cost</small><strong>${{ totalCost.toFixed(4) }}</strong>
          </div>
        </section>
        <section class="panel">
          <div class="panel-title">
            <div>
              <h2>Recent experiments</h2>
              <p>Results include paired confidence intervals.</p>
            </div>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Runner</th>
                  <th>Baseline</th>
                  <th>Candidate</th>
                  <th>Change</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in experiments"
                  :key="item.id"
                  class="clickable"
                  @click="openExperiment(item.id)"
                >
                  <td>
                    <strong>{{ item.name }}</strong>
                  </td>
                  <td>
                    <span class="runner-label">{{ item.runnerType }}</span>
                  </td>
                  <td>{{ percent(item.baselineScore) }}</td>
                  <td>{{ percent(item.candidateScore) }}</td>
                  <td :class="(item.candidateScore ?? 0) > (item.baselineScore ?? 0) ? 'text-good' : ''">
                    {{
                      item.baselineScore == null || item.candidateScore == null
                        ? '—'
                        : signedPercent(item.candidateScore - item.baselineScore)
                    }}
                  </td>
                  <td>
                    <span class="badge small" :class="statusClass(item.status)">{{ item.status }}</span>
                  </td>
                  <td>{{ formatDate(item.createdAt) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <template v-else-if="tab === 'tasks'">
        <header class="page-header">
          <div>
            <h1>Task sets</h1>
            <p>Prompts and deterministic criteria used to score every configuration.</p>
          </div>
        </header>
        <section class="definition-grid">
          <article v-for="set in taskSets" :key="set.id" class="panel definition">
            <div class="eyebrow">{{ set.tasks.length }} tasks</div>
            <h2>{{ set.name }}</h2>
            <p>{{ set.description }}</p>
            <div v-for="task in set.tasks" :key="task.id" class="definition-row">
              <div>
                <strong>{{ task.name }}</strong
                ><small>{{ task.prompt }}</small>
              </div>
              <span class="runner-label">{{ task.scorerType }}</span>
            </div>
          </article>
        </section>
      </template>

      <template v-else>
        <header class="page-header">
          <div>
            <h1>Agent configurations</h1>
            <p>Models, skills, memory and tools passed to Hermes Agent.</p>
          </div>
        </header>
        <section class="definition-grid">
          <article v-for="config in configs" :key="config.id" class="panel config-card">
            <div class="config-head">
              <span class="config-icon">◇</span>
              <div>
                <h2>{{ config.name }}</h2>
                <p>{{ config.description }}</p>
              </div>
            </div>
            <dl>
              <div>
                <dt>Provider</dt>
                <dd>{{ config.provider }}</dd>
              </div>
              <div>
                <dt>Model</dt>
                <dd>{{ config.model }}</dd>
              </div>
              <div>
                <dt>Memory</dt>
                <dd>{{ config.memoryEnabled ? 'Enabled' : 'Disabled' }}</dd>
              </div>
              <div>
                <dt>Tools</dt>
                <dd>
                  <span v-for="tool in config.tools" :key="tool" class="chip">{{ tool }}</span>
                </dd>
              </div>
              <div>
                <dt>Skills</dt>
                <dd>
                  <span v-if="!config.skills.length">None</span
                  ><span v-for="skill in config.skills" :key="skill" class="chip">{{ skill }}</span>
                </dd>
              </div>
            </dl>
          </article>
        </section>
      </template>
    </main>

    <div v-if="showNewExperiment" class="modal-backdrop" @click.self="showNewExperiment = false">
      <form class="modal" @submit.prevent="createExperiment">
        <div class="modal-head">
          <div>
            <h2>New experiment</h2>
            <p>Run the same task set under two configurations.</p>
          </div>
          <button type="button" class="close" @click="showNewExperiment = false">×</button>
        </div>
        <label>Name<input v-model="form.name" required /></label
        ><label
          >Task set<select v-model="form.taskSetId">
            <option v-for="set in taskSets" :key="set.id" :value="set.id">{{ set.name }}</option>
          </select></label
        >
        <div class="form-grid">
          <label
            >Baseline<select v-model="form.baselineConfigId">
              <option v-for="config in configs" :key="config.id" :value="config.id">{{ config.name }}</option>
            </select></label
          ><label
            >Candidate<select v-model="form.candidateConfigId">
              <option v-for="config in configs" :key="config.id" :value="config.id">{{ config.name }}</option>
            </select></label
          >
        </div>
        <div class="form-grid">
          <label
            >Runner<select v-model="form.runnerType">
              <option value="demo">Demo (no API key)</option>
              <option value="hermes">Hermes Agent</option>
            </select></label
          ><label
            >Repetitions<input v-model.number="form.repetitions" type="number" min="1" max="20"
          /></label>
        </div>
        <div class="hint">
          <strong>{{ form.runnerType === 'hermes' ? 'Hermes run' : 'Demo run' }}</strong
          ><span>{{
            form.runnerType === 'hermes'
              ? 'Requires Hermes and provider credentials. Model calls may incur cost.'
              : 'Deterministic simulator for trying the workflow locally.'
          }}</span>
        </div>
        <div class="modal-actions">
          <button type="button" class="secondary" @click="showNewExperiment = false">Cancel</button
          ><button class="primary" :disabled="submitting">
            {{ submitting ? 'Creating…' : 'Create experiment' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
