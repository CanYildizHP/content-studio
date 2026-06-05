import { ChildProcess } from 'child_process';

export type RunStatus = 'running' | 'complete' | 'failed';

export interface RunRecord {
  runId: string;
  skill: string;
  args: string;
  startTime: string;
  status: RunStatus;
  exitCode: number | null;
  outputBuffer: string[];
  hasStdin: boolean;
}

declare global {
  var __runnerStore: Map<string, RunRecord> | undefined;
  var __runnerProcesses: Map<string, ChildProcess> | undefined;
}

export const runnerStore: Map<string, RunRecord> =
  globalThis.__runnerStore ?? (globalThis.__runnerStore = new Map());

export const runnerProcesses: Map<string, ChildProcess> =
  globalThis.__runnerProcesses ?? (globalThis.__runnerProcesses = new Map());

export function getRecentRuns(limit = 10): RunRecord[] {
  return [...runnerStore.values()]
    .sort((a, b) => b.startTime.localeCompare(a.startTime))
    .slice(0, limit);
}
