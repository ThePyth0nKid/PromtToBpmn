import type { ProcessJson, ProcessModel, ProcessNode, SequenceFlow } from './types';

const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

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

export async function textToProcessJson(prompt: string, errors?: string[]): Promise<ProcessJson> {
  if (USE_MOCK) return mockTextToJson(prompt, errors);

  const provider = (import.meta.env.VITE_LLM_PROVIDER as string) || 'custom';

  if (provider.toLowerCase() === 'openrouter') {
    return withRetry(async () => {
      const url =
        (import.meta.env.VITE_LLM_API_URL as string) || 'https://openrouter.ai/api/v1/chat/completions';
      const apiKey = import.meta.env.VITE_LLM_API_KEY as string;
      const model =
        (import.meta.env.VITE_OPENROUTER_MODEL as string) || 'openai/gpt-4o-mini';
      const referer = import.meta.env.VITE_OPENROUTER_REFERER as string | undefined;
      const title = (import.meta.env.VITE_OPENROUTER_TITLE as string) || 'Prompt-to-BPMN';
      if (!apiKey) throw new Error('OpenRouter API Key fehlt');

      const system = `Du bist ein strikter Parser. Antworte ausschließlich mit kompaktem JSON im folgenden Schema und ohne zusätzlichen Text.
{
  "process": {
    "id": "string",
    "name": "string",
    "nodes": [
      { "id": "string", "type": "startEvent|task|exclusiveGateway|endEvent", "name": "string?" }
    ],
    "flows": [ { "id": "string", "source": "nodeId", "target": "nodeId" } ]
  }
}`;

      const user = `Erzeuge die Prozessstruktur als JSON basierend auf dieser Beschreibung. Verwende nur die erlaubten Knotentypen. Beschreibung: ${prompt}`;
      const errorMsg = errors && errors.length > 0 ? `Bekannte Validierungsfehler: ${errors.join('; ')}` : '';

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
          response_format: { type: 'json_object' }
        }),
      });
      if (!res.ok) throw new Error(`OpenRouter Fehler: ${res.status}`);
      const data = await res.json();
      let content: string = '';
      const choice = data?.choices?.[0]?.message?.content;
      if (typeof choice === 'string') content = choice;
      else if (Array.isArray(choice)) content = choice.map((c: any) => c?.text ?? '').join('\n');
      else content = JSON.stringify(choice ?? {});

      // Versuche JSON zu extrahieren
      const start = content.indexOf('{');
      const end = content.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('Ungültige OpenRouter-Antwort (kein JSON)');
      const jsonStr = content.slice(start, end + 1);
      const parsed = JSON.parse(jsonStr) as ProcessJson;
      return parsed;
    });
  }

  // Generic custom backend that already returns ProcessJson
  return withRetry(async () => {
    const url = import.meta.env.VITE_LLM_API_URL as string;
    const apiKey = import.meta.env.VITE_LLM_API_KEY as string;
    if (!url || !apiKey) throw new Error('LLM Backend nicht konfiguriert');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ prompt, errors }),
    });
    if (!res.ok) throw new Error(`LLM Fehler: ${res.status}`);
    const data = (await res.json()) as ProcessJson;
    return data;
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
