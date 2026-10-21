import { computed, onMounted, onUnmounted, ref } from 'vue';
import type {
  AgentConfig,
  ExperimentDetail,
  ExperimentSummary,
  RunDetail,
  RunnerType,
  TaskSet,
} from '@agent-evals/shared';
import { api } from '../api';

export type WorkspaceTab = 'experiments' | 'tasks' | 'configs';

interface ExperimentForm {
  name: string;
  taskSetId: string;
  baselineConfigId: string;
  candidateConfigId: string;
  runnerType: RunnerType;
  repetitions: number;
}

const POLL_INTERVAL_MS = 1_000;

export function useWorkspace() {
  const tab = ref<WorkspaceTab>('experiments');
  const experiments = ref<ExperimentSummary[]>([]);
  const taskSets = ref<TaskSet[]>([]);
  const configs = ref<AgentConfig[]>([]);
  const selectedExperiment = ref<ExperimentDetail | null>(null);
  const selectedRun = ref<RunDetail | null>(null);
  const loading = ref(true);
  const error = ref('');
  const showNewExperiment = ref(false);
  const submitting = ref(false);
  const form = ref<ExperimentForm>({
    name: 'New comparison',
    taskSetId: '',
    baselineConfigId: '',
    candidateConfigId: '',
    runnerType: 'demo',
    repetitions: 3,
  });
  let pollTimer: number | undefined;

  const completedExperiments = computed(
    () => experiments.value.filter(({ status }) => status === 'completed').length,
  );
  const totalRuns = computed(() => selectedExperiment.value?.runs.length ?? 0);
  const totalCost = computed(
    () => selectedExperiment.value?.runs.reduce((sum, run) => sum + run.estimatedCostUsd, 0) ?? 0,
  );

  onMounted(loadAll);
  onUnmounted(stopPolling);

  async function loadAll() {
    loading.value = true;
    error.value = '';
    try {
      [experiments.value, taskSets.value, configs.value] = await Promise.all([
        api<ExperimentSummary[]>('/experiments'),
        api<TaskSet[]>('/task-sets'),
        api<AgentConfig[]>('/configs'),
      ]);
      setFormDefaults();
    } catch (cause) {
      setError(cause);
    } finally {
      loading.value = false;
    }
  }

  async function openExperiment(id: string) {
    error.value = '';
    selectedRun.value = null;
    try {
      const detail = await api<ExperimentDetail>(`/experiments/${encodeURIComponent(id)}`);
      selectedExperiment.value = detail;
      if (detail.status === 'running') schedulePoll(id);
    } catch (cause) {
      setError(cause);
    }
  }

  function closeExperiment() {
    selectedExperiment.value = null;
    selectedRun.value = null;
    stopPolling();
  }

  async function openRun(id: string) {
    error.value = '';
    try {
      selectedRun.value = await api<RunDetail>(`/runs/${encodeURIComponent(id)}`);
    } catch (cause) {
      setError(cause);
    }
  }

  async function createExperiment() {
    submitting.value = true;
    error.value = '';
    try {
      const created = await api<ExperimentSummary>('/experiments', {
        method: 'POST',
        body: JSON.stringify(form.value),
      });
      showNewExperiment.value = false;
      experiments.value = await api<ExperimentSummary[]>('/experiments');
      await openExperiment(created.id);
    } catch (cause) {
      setError(cause);
    } finally {
      submitting.value = false;
    }
  }

  async function runExperiment() {
    const experiment = selectedExperiment.value;
    if (!experiment) return;
    error.value = '';
    try {
      await api(`/experiments/${encodeURIComponent(experiment.id)}/run`, { method: 'POST' });
      await openExperiment(experiment.id);
    } catch (cause) {
      setError(cause);
    }
  }

  function schedulePoll(id: string) {
    stopPolling();
    pollTimer = window.setTimeout(async () => {
      try {
        const detail = await api<ExperimentDetail>(`/experiments/${encodeURIComponent(id)}`);
        selectedExperiment.value = detail;
        if (detail.status === 'running') schedulePoll(id);
        else experiments.value = await api<ExperimentSummary[]>('/experiments');
      } catch (cause) {
        setError(cause);
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }

  function stopPolling() {
    if (pollTimer !== undefined) window.clearTimeout(pollTimer);
    pollTimer = undefined;
  }

  function setFormDefaults() {
    if (!form.value.taskSetId && taskSets.value[0]) form.value.taskSetId = taskSets.value[0].id;
    if (!form.value.baselineConfigId && configs.value[0]) form.value.baselineConfigId = configs.value[0].id;
    if (!form.value.candidateConfigId && configs.value[1]) form.value.candidateConfigId = configs.value[1].id;
  }

  function setError(cause: unknown) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }

  function clearError() {
    error.value = '';
  }

  function percent(value: number | null | undefined) {
    return value == null ? '—' : `${Math.round(value * 100)}%`;
  }

  function signedPercent(value: number) {
    const rounded = Math.round(value * 100);
    return `${rounded > 0 ? '+' : ''}${rounded} pp`;
  }

  function statusClass(status: string) {
    if (['passed', 'completed'].includes(status)) return 'good';
    if (['failed', 'error'].includes(status)) return 'bad';
    return 'neutral';
  }

  function taskName(taskId: string) {
    return selectedExperiment.value?.taskSet.tasks.find(({ id }) => id === taskId)?.name ?? taskId;
  }

  function configName(configId: string) {
    return configId === selectedExperiment.value?.baselineConfigId ? 'Baseline' : 'Candidate';
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  return {
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
  };
}
