import type { ProcessJson, ProcessModel, ProcessNode, SequenceFlow } from './types';

export type LlmDiag = {
  provider: string;
  usingMock: boolean;
  url?: string;
  model?: string;
  requestStartedAt: number;
  requestFinishedAt?: number;
  durationMs?: number;
  ok?: boolean;
  status?: number;
  requestId?: string;
  error?: string;
  snippet?: string;
};

function parseBool(val: any): boolean | undefined {
  if (val == null) return undefined;
  const s = String(val).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(s)) return false;
  return undefined;
}

function isMockEnabled(provider?: string): boolean {
  const envVal = parseBool(import.meta.env.VITE_USE_MOCK);
  // Wenn Provider explizit openrouter, standardmäßig kein Mock, außer explizit true gesetzt
  if ((provider || '').toLowerCase() === 'openrouter') return envVal === true ? true : false;
  // Default: Mock AN, außer explizit false
  return envVal === undefined ? true : envVal;
}

export function llmMode() {
  const provider = (import.meta.env.VITE_LLM_PROVIDER as string) || 'mock';
  const usingMock = isMockEnabled(provider);
  const url = import.meta.env.VITE_LLM_API_URL as string | undefined;
  const model = (import.meta.env.VITE_OPENROUTER_MODEL as string) || undefined;
  return { usingMock, provider, url, model };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2, backoffMs = 500): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await sleep(backoffMs);
    return withRetry(fn, retries - 1, backoffMs * 2);
  }
}

// Neue Hilfsfunktion: Hard-Test gegen OpenRouter (ignoriert Mock)
export async function testOpenRouterEcho(prompt: string): Promise<{ diag: LlmDiag; content: string }> {
  const url = (import.meta.env.VITE_LLM_API_URL as string) || 'https://openrouter.ai/api/v1/chat/completions';
  const apiKey = import.meta.env.VITE_LLM_API_KEY as string;
  const model = (import.meta.env.VITE_OPENROUTER_MODEL as string) || 'openai/gpt-4o-mini';
  const referer = import.meta.env.VITE_OPENROUTER_REFERER as string | undefined;
  const title = (import.meta.env.VITE_OPENROUTER_TITLE as string) || 'Prompt-to-BPMN';
  if (!apiKey) throw new Error('OpenRouter API Key fehlt');

  const started = Date.now();
  let diag: LlmDiag = { provider: 'openrouter', usingMock: false, url, model, requestStartedAt: started };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(referer ? { 'HTTP-Referer': referer } : {}),
      'X-Title': title,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: 'Antworte exakt mit dem vom Nutzer gelieferten Text. Keine Zusätze.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
    }),
  });
  const finished = Date.now();
  diag.requestFinishedAt = finished;
  diag.durationMs = finished - started;
  diag.status = res.status;
  diag.ok = res.ok;
  diag.requestId = res.headers.get('x-request-id') || res.headers.get('x-openrouter-id') || undefined;

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    diag.error = `HTTP ${res.status}: ${txt.slice(0, 200)}`;
    throw Object.assign(new Error(diag.error), { diag });
  }

  const data = await res.json();
  let content: string = '';
  const choice = data?.choices?.[0]?.message?.content;
  if (typeof choice === 'string') content = choice;
  else if (Array.isArray(choice)) content = choice.map((c: any) => c?.text ?? '').join('\n');
  else content = JSON.stringify(choice ?? {});
  diag.snippet = content.slice(0, 160);
  return { diag, content };
}

export async function textToProcessJson(
  prompt: string,
  errors?: string[],
  diagCb?: (d: LlmDiag) => void,
): Promise<ProcessJson> {
  const provider = (import.meta.env.VITE_LLM_PROVIDER as string) || 'mock';
  const useMock = isMockEnabled(provider);

  if (useMock) {
    const started = Date.now();
    const result = mockTextToJson(prompt, errors);
    const d: LlmDiag = { provider: provider || 'mock', usingMock: true, requestStartedAt: started, requestFinishedAt: Date.now(), durationMs: Date.now() - started, ok: true, status: 200, snippet: 'mock' };
    console.info('[LLM] MOCK used', d);
    diagCb?.(d);
    return result;
  }

  if (provider.toLowerCase() === 'openrouter') {
    return withRetry(async () => {
      const url =
        (import.meta.env.VITE_LLM_API_URL as string) || 'https://openrouter.ai/api/v1/chat/completions';
      const apiKey = import.meta.env.VITE_LLM_API_KEY as string;
      const model = (import.meta.env.VITE_OPENROUTER_MODEL as string) || 'openai/gpt-4o-mini';
      const referer = import.meta.env.VITE_OPENROUTER_REFERER as string | undefined;
      const title = (import.meta.env.VITE_OPENROUTER_TITLE as string) || 'Prompt-to-BPMN';
      if (!apiKey) throw new Error('OpenRouter API Key fehlt');

      const system = `Du bist ein strikter Parser. Antworte ausschließlich mit kompaktem JSON im folgenden Schema und ohne zusätzlichen Text.\n{\n  "process": {\n    "id": "string",\n    "name": "string",\n    "nodes": [\n      { "id": "string", "type": "startEvent|task|exclusiveGateway|endEvent", "name": "string?" }\n    ],\n    "flows": [ { "id": "string", "source": "nodeId", "target": "nodeId" } ]\n  }\n}`;

      const user = `Erzeuge die Prozessstruktur als JSON basierend auf dieser Beschreibung. Verwende nur die erlaubten Knotentypen. Beschreibung: ${prompt}`;
      const errorMsg = errors && errors.length > 0 ? `Bekannte Validierungsfehler: ${errors.join('; ')}` : '';

      const started = Date.now();
      let diag: LlmDiag = { provider: 'openrouter', usingMock: false, url, model, requestStartedAt: started };

      try {
        console.info('[LLM] OpenRouter request', { url, model, referer, title });
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            ...(referer ? { 'HTTP-Referer': referer } : {}),
            'X-Title': title,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
              ...(errorMsg ? [{ role: 'user', content: errorMsg }] : []),
            ],
            temperature: 0,
            response_format: { type: 'json_object' },
          }),
        });
        const finished = Date.now();
        diag.requestFinishedAt = finished;
        diag.durationMs = finished - started;
        diag.status = res.status;
        diag.ok = res.ok;
        diag.requestId = res.headers.get('x-request-id') || res.headers.get('x-openrouter-id') || undefined;

        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          diag.error = `HTTP ${res.status}: ${txt.slice(0, 200)}`;
          console.error('[LLM] OpenRouter error', diag);
          diagCb?.(diag);
          throw new Error(`OpenRouter Fehler: ${res.status}`);
        }

        const data = await res.json();
        let content: string = '';
        const choice = data?.choices?.[0]?.message?.content;
        if (typeof choice === 'string') content = choice;
        else if (Array.isArray(choice)) content = choice.map((c: any) => c?.text ?? '').join('\n');
        else content = JSON.stringify(choice ?? {});
        diag.snippet = content.slice(0, 160);
        console.info('[LLM] OpenRouter ok', { status: res.status, durationMs: diag.durationMs, requestId: diag.requestId });
        diagCb?.(diag);

        const start = content.indexOf('{');
        const end = content.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error('Ungültige OpenRouter-Antwort (kein JSON)');
        const jsonStr = content.slice(start, end + 1);
        const parsed = JSON.parse(jsonStr) as ProcessJson;
        return parsed;
      } catch (e: any) {
        if (!diag.requestFinishedAt) {
          const finished = Date.now();
          diag.requestFinishedAt = finished;
          diag.durationMs = finished - started;
        }
        diag.ok = false;
        diag.error = e?.message ?? String(e);
        console.error('[LLM] OpenRouter exception', diag);
        diagCb?.(diag);
        throw e;
      }
    });
  }

  // Generic custom backend that already returns ProcessJson
  return withRetry(async () => {
    const url = import.meta.env.VITE_LLM_API_URL as string;
    const apiKey = import.meta.env.VITE_LLM_API_KEY as string;
    if (!url || !apiKey) throw new Error('LLM Backend nicht konfiguriert');
    const started = Date.now();
    let diag: LlmDiag = { provider: 'custom', usingMock: false, url, requestStartedAt: started };
    try {
      console.info('[LLM] Custom request', { url });
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ prompt, errors }),
      });
      const finished = Date.now();
      diag.requestFinishedAt = finished;
      diag.durationMs = finished - started;
      diag.status = res.status;
      diag.ok = res.ok;
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        diag.error = `HTTP ${res.status}: ${txt.slice(0, 200)}`;
        console.error('[LLM] Custom error', diag);
        diagCb?.(diag);
        throw new Error(`LLM Fehler: ${res.status}`);
      }
      const data = (await res.json()) as ProcessJson;
      diag.snippet = JSON.stringify(data).slice(0, 160);
      console.info('[LLM] Custom ok', { status: res.status, durationMs: diag.durationMs });
      diagCb?.(diag);
      return data;
    } catch (e: any) {
      if (!diag.requestFinishedAt) {
        const finished = Date.now();
        diag.requestFinishedAt = finished;
        diag.durationMs = finished - started;
      }
      diag.ok = false;
      diag.error = e?.message ?? String(e);
      console.error('[LLM] Custom exception', diag);
      diagCb?.(diag);
      throw e;
    }
  });
}

function stableId(prefix: string, index: number): string {
  return `${prefix}_${index + 1}`;
}

function extractSteps(text: string): string[] {
  // Split by newlines and common delimiters; filter trivial tokens
  const raw = text
    .split(/\n|\.|;|->/g)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  // Deduplicate consecutive duplicates
  const steps: string[] = [];
  for (const s of raw) {
    if (steps.length === 0 || steps[steps.length - 1].toLowerCase() !== s.toLowerCase()) {
      steps.push(s);
    }
  }
  return steps.length > 0 ? steps : ['Prozess starten', 'Schritt ausführen', 'Prozess beenden'];
}

export function mockTextToJson(prompt: string, _errors?: string[]): ProcessJson {
  const steps = extractSteps(prompt || 'Start; Schritt; Ende');

  const nodes: ProcessNode[] = [];
  const flows: SequenceFlow[] = [];

  const startId = stableId('StartEvent', 0);
  nodes.push({ id: startId, type: 'startEvent', name: 'Start' });

  let lastId = startId;

  steps.forEach((step, i) => {
    const taskId = stableId('Activity', i);
    nodes.push({ id: taskId, type: 'task', name: step });
    const flowId = stableId('Flow', i);
    flows.push({ id: flowId, source: lastId, target: taskId });
    lastId = taskId;
  });

  const endId = stableId('EndEvent', steps.length);
  nodes.push({ id: endId, type: 'endEvent', name: 'Ende' });
  flows.push({ id: stableId('Flow', steps.length), source: lastId, target: endId });

  const model: ProcessModel = {
    id: 'Process_1',
    name: 'Generated Process',
    nodes,
    flows,
  };

  return { process: model };
}
