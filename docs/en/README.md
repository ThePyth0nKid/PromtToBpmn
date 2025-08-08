# Prompt → BPMN (Documentation, EN)

This app turns natural language (text/voice) into BPMN 2.0, renders it in the browser, validates the structure, and supports exporting (XML/SVG/PNG) and inspecting a demo run timeline.

## Contents
- Goal & Overview
- Architecture & Data Flow
- Installation & Development
- Environment (.env)
- LLM Integration (OpenRouter) & Mock
- Voice Input (Web Speech API)
- Deterministic JSON → BPMN Mapping
- Automatic Layout (columns, orthogonal routing)
- Validation & “Improve” loop
- Live Run (Demo) & Logs
- Export (diagram & run JSON)
- Troubleshooting

---

## Goal & Overview
Rapidly prototype and demo processes: A short description becomes a readable BPMN diagram. You can use a real LLM via OpenRouter or an offline mock.

## Architecture & Data Flow
1. Input: Prompt via text field or live transcript via microphone.
2. Processing: `textToProcessJson(prompt)` produces a compact, block-based JSON representation.
3. Mapping: `jsonToBpmnXml(json)` deterministically converts the JSON to BPMN 2.0 XML (with DI layout).
4. Rendering: `bpmn-js` imports the XML; auto-fit for best view.
5. Validation: Start/End, gateways, and flow consistency checks. On errors, you can run “Improve”.
6. Live Run (Demo): Each step shows status (pending/running/success/failure) with overlays, plus log + details.

```ts
// src/services/llm.ts (excerpt)
export async function textToProcessJson(prompt: string) {
  // chooses mock or OpenRouter based on .env
}

// src/services/bpmn.ts (excerpt)
export function jsonToBpmnXml(model: ProcessJson): string {
  // outputs BPMN 2.0 XML + DI with column layout & orthogonal edges
}
```

## Installation & Development
Requirements: Node 20+, npm or pnpm

```bash
npm install
npm run dev
# http://localhost:5173

npm run build
npm run preview

npm run lint
npm run format
```

## Environment (.env)
Create `.env` from `sample.env`.

```env
VITE_USE_MOCK=false
VITE_LLM_PROVIDER=openrouter
VITE_LLM_API_KEY=sk-or-v1-...
VITE_LLM_API_URL=https://openrouter.ai/api/v1/chat/completions
VITE_OPENROUTER_MODEL=openai/gpt-4o-mini
VITE_OPENROUTER_REFERER=http://localhost:5173
VITE_OPENROUTER_TITLE=Prompt-to-BPMN
```

- Enable mock: `VITE_USE_MOCK=true`
- Use the real LLM: `VITE_USE_MOCK=false` and `VITE_LLM_PROVIDER=openrouter`

## LLM Integration (OpenRouter) & Mock
- The UI provides an “LLM Test” (Echo). It calls OpenRouter directly and shows status/duration/request-id and raw content.
- Regular generate/improve calls show a header badge (LLM OK/ERR) and a diagnosis box below the prompt panel.

```ts
// Direct echo test against OpenRouter
import { testOpenRouterEcho } from '../../services/llm';
const { diag, content } = await testOpenRouterEcho('ping');
console.log(diag.status, diag.durationMs, content);
```

## Voice Input (Web Speech API)
- Feature-detects `SpeechRecognition`/`webkitSpeechRecognition`
- Continuous transcript goes straight into the prompt field

```ts
// src/ui/VoiceInput.tsx (simplified)
rec.continuous = true;
rec.interimResults = true;
rec.lang = 'de-DE';
rec.start();
```

## Deterministic JSON → BPMN Mapping
- No free text is injected into the XML
- Node types: `startEvent | task | exclusiveGateway | endEvent`
- Flows: `sequenceFlow` with `sourceRef`/`targetRef`

```ts
// Example structure (simplified)
{
  process: {
    id: 'Process_1',
    nodes: [
      { id: 'StartEvent_1', type: 'startEvent', name: 'Start' },
      { id: 'Activity_1', type: 'task', name: 'Validate order' },
      { id: 'Gateway_1', type: 'exclusiveGateway' },
      { id: 'EndEvent_1', type: 'endEvent', name: 'End' }
    ],
    flows: [
      { id: 'Flow_1', source: 'StartEvent_1', target: 'Activity_1' },
      { id: 'Flow_2', source: 'Activity_1', target: 'Gateway_1' },
      { id: 'Flow_3', source: 'Gateway_1', target: 'EndEvent_1' }
    ]
  }
}
```

## Automatic Layout
- Column assignment: branches spread relative to the current column (−1, +1, −2, +2 …)
- Rejoins are centered based on the average of parent columns
- Levels via longest path for stable layering
- Orthogonal edge routing with short vertical drops and a horizontal mid segment

```ts
// src/services/bpmn.ts (excerpt)
const CENTER_X = 500;
const COLUMN_OFFSET = 260; // horizontal distance
const V_GAP = 140;         // vertical gap
```

## Validation & “Improve” loop
- Checks: start/end present, gateways not open, consistent sequence flows
- On errors, the UI shows messages and “Improve” initiates another LLM round with error context

```ts
import { validateProcess } from '../../services/validate';
const errors = validateProcess(json);
if (errors.length) { /* show & improve */ }
```

## Live Run (Demo) & Logs
- Demo runner simulates step status changes (pending → running → success/failure), overlays/markers in the diagram
- Click an element to open the details panel on the right
- Log panel (filterable) shows a timeline; export as `run.json`

```ts
import { startDemoRun } from '../../services/runner';
const ctrl = startDemoRun(model, (ev) => console.log(ev));
```

## Export (diagram & run JSON)
- `Export XML` → BPMN 2.0 XML
- `Export SVG/PNG` → image export
- `Export Run JSON` → complete run log including LLM diagnostics

## Troubleshooting
- Header badge (LLM OK/ERR) and diagnosis box under the prompt
- Browser DevTools → Network: POST to `openrouter.ai/api/v1/chat/completions`
- Storage quota errors: clear site data in Application tab

---

Enjoy! Swimlanes (pools/lanes), BPMN annotations, or advanced layout rules can be added as next steps.
