import type { ProcessJson } from './types';

export type RunStatus = 'pending' | 'running' | 'success' | 'failure';
export type RunEvent = {
  elementId: string;
  status: RunStatus;
  timestamp: number;
  durationMs?: number;
  message?: string;
};

export type RunController = { stop: () => void };

export function startDemoRun(
  model: ProcessJson,
  onEvent: (ev: RunEvent) => void,
  options?: { baseDelayMs?: number; failureRate?: number },
): RunController {
  const base = options?.baseDelayMs ?? 600;
  const failureRate = options?.failureRate ?? 0.15;
  const nodes = model.process.nodes;
  let stopped = false;

  const walkOrder = nodes.map((n) => n.id); // naive linear for demo

  (async () => {
    for (const id of walkOrder) {
      if (stopped) break;
      const start = Date.now();
      onEvent({ elementId: id, status: 'pending', timestamp: start });
      await sleep(base * 0.5);
      if (stopped) break;
      onEvent({ elementId: id, status: 'running', timestamp: Date.now() });
      await sleep(base + Math.random() * base);
      if (stopped) break;
      const failed = Math.random() < failureRate && !/start|end/i.test(id);
      const status: RunStatus = failed ? 'failure' : 'success';
      onEvent({ elementId: id, status, timestamp: Date.now(), durationMs: Date.now() - start, message: failed ? 'Demo-Fehler' : 'OK' });
      if (failed) {
        // retry once
        await sleep(base * 0.6);
        const retryStart = Date.now();
        onEvent({ elementId: id, status: 'running', timestamp: retryStart, message: 'Retry' });
        await sleep(base);
        onEvent({ elementId: id, status: 'success', timestamp: Date.now(), durationMs: Date.now() - retryStart, message: 'Erfolg nach Retry' });
      }
    }
  })();

  return { stop: () => { stopped = true; } };
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
