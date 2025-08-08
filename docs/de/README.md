# Prompt → BPMN (Dokumentation, DE)

Diese App wandelt natürliche Sprache (Text/Voice) in BPMN 2.0 um, rendert das Diagramm im Browser, validiert die Struktur und ermöglicht Export (XML/SVG/PNG) sowie das Nachvollziehen eines Demo-Laufs.

## Inhalt
- Ziel & Überblick
- Architektur & Datenfluss
- Installation & Entwicklung
- Umgebungsvariablen (.env)
- LLM-Integration (OpenRouter) & Mock
- Voice Input (Web Speech API)
- JSON → BPMN Mapping (deterministisch)
- Automatisches Layout (Spalten, Orthogonalrouting)
- Validierung & „Verbessern“-Flow
- Live-Run (Demo) & Protokoll
- Export (Diagramm & Run-JSON)
- Fehlerdiagnose

---

## Ziel & Überblick
Die App ist für schnelle Prototypen und Demos konzipiert: Aus einer kurzen Prozessbeschreibung entsteht ein verständliches BPMN-Diagramm. Du kannst wahlweise ein echtes LLM per OpenRouter nutzen oder offline mit einem Mock arbeiten.

## Architektur & Datenfluss
1. Eingabe: Prompt im Textfeld oder Live-Transkript über Mikrofon.
2. Verarbeitung: `textToProcessJson(prompt)` erzeugt eine kompakte, block-orientierte JSON-Zwischenrepräsentation.
3. Mapping: `jsonToBpmnXml(json)` konvertiert deterministisch zu BPMN 2.0 XML inkl. DI (Layout).
4. Rendering: `bpmn-js` importiert das XML und zeigt das Diagramm; Auto-Fit sorgt für die passende Ansicht.
5. Validierung: Checks auf Start/End, Gateways und Sequenzflüsse. Bei Fehlern: „Verbessern“-Runde.
6. Live-Run (Demo): Status (pending/running/success/failure) pro Schritt, Overlays im Diagramm, Log & Details.

```ts
// src/services/llm.ts (Ausschnitt)
export async function textToProcessJson(prompt: string) {
  // nutzt Mock oder OpenRouter, abhängig von .env
}

// src/services/bpmn.ts (Ausschnitt)
export function jsonToBpmnXml(model: ProcessJson): string {
  // generiert BPMN 2.0 XML + DI mit Spaltenlayout & orthogonalen Kanten
}
```

## Installation & Entwicklung
Voraussetzungen: Node 20+, npm oder pnpm

```bash
npm install
npm run dev
# http://localhost:5173

npm run build
npm run preview

npm run lint
npm run format
```

## Umgebungsvariablen (.env)
Lege `.env` auf Basis von `sample.env` an.

```env
VITE_USE_MOCK=false
VITE_LLM_PROVIDER=openrouter
VITE_LLM_API_KEY=sk-or-v1-...
VITE_LLM_API_URL=https://openrouter.ai/api/v1/chat/completions
VITE_OPENROUTER_MODEL=openai/gpt-4o-mini
VITE_OPENROUTER_REFERER=http://localhost:5173
VITE_OPENROUTER_TITLE=Prompt-to-BPMN
```

- Mock einschalten: `VITE_USE_MOCK=true`
- Echtes LLM einschalten: `VITE_USE_MOCK=false` und `VITE_LLM_PROVIDER=openrouter`

## LLM-Integration (OpenRouter) & Mock
- Die App bietet einen „LLM Test“-Button (Echo). Er ruft OpenRouter direkt auf und zeigt Status/Dauer/Request-ID sowie die Rohantwort.
- Jeder reguläre Generieren/Verbessern-Aufruf zeigt im Header ein LLM-Badge (OK/ERR) und eine Diagnosenbox unterhalb des Prompt-Panels.

```ts
// Direkter Echo-Test gegen OpenRouter
import { testOpenRouterEcho } from '../../services/llm';
const { diag, content } = await testOpenRouterEcho('ping');
console.log(diag.status, diag.durationMs, content);
```

## Voice Input (Web Speech API)
- Feature-Detection für `SpeechRecognition`/`webkitSpeechRecognition`
- Kontinuierliches Transkript landet direkt im Prompt-Feld

```ts
// src/ui/VoiceInput.tsx (vereinfacht)
rec.continuous = true;
rec.interimResults = true;
rec.lang = 'de-DE';
rec.start();
```

## JSON → BPMN Mapping (deterministisch)
- Keine freie Textinterpretation im XML
- Knoten: `startEvent | task | exclusiveGateway | endEvent`
- Flüsse: `sequenceFlow` mit `sourceRef`/`targetRef`

```ts
// Beispielstruktur (vereinfacht)
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

## Automatisches Layout
- Spaltenzuweisung: Verzweigungen verteilen Zweige relativ zur aktuellen Spalte (−1, +1, −2, +2 …)
- Rejoins werden per Mittelwert der Elternspalten wieder zentriert
- Ebenen via Longest-Path: Stabil nach Verzweigungen
- Orthogonales Routing: Kanten mit kurzen vertikalen Drops und horizontalem Steg

```ts
// src/services/bpmn.ts (Ausschnitt)
const CENTER_X = 500;
const COLUMN_OFFSET = 260; // seitlicher Abstand
const V_GAP = 140;         // vertikaler Abstand
```

## Validierung & „Verbessern“-Flow
- Checks: Start-/End-Event vorhanden, Gateways ohne offene Kanten, Flüsse konsistent
- Bei Fehlern werden Meldungen im PromptPanel angezeigt; „Verbessern“ startet eine weitere LLM-Runde mit Fehlerkontext

```ts
import { validateProcess } from '../../services/validate';
const errors = validateProcess(json);
if (errors.length) { /* anzeigen & improve */ }
```

## Live-Run (Demo) & Protokoll
- Demo-Runner simuliert Statuswechsel je Schritt (pending → running → success/failure), Overlays/Marker im Diagramm
- Rechtsklick auf Elemente nicht nötig; einfacher Klick öffnet ein Detailpanel rechts
- Log-Panel (filterbar) zeigt den Ablauf in Zeitreihenform, Export als `run.json`

```ts
import { startDemoRun } from '../../services/runner';
const ctrl = startDemoRun(model, (ev) => console.log(ev));
```

## Export (Diagramm & Run-JSON)
- `Export XML` → BPMN 2.0 XML
- `Export SVG/PNG` → Bildexport
- `Export Run JSON` → vollständiges Laufprotokoll inkl. LLM-Diagnostik

## Fehlerdiagnose
- LLM-Badge im Header (OK/ERR), Diagnosenbox unter dem Prompt
- Browser DevTools → Network: POST auf `openrouter.ai/api/v1/chat/completions`
- Quota-/Storage-Fehler: ggf. Site Storage leeren (Application → Clear site data)

---

Viel Erfolg beim Ausprobieren! Bei Bedarf lassen sich Schwimmbahnen (Pools/Lanes), BPMN-Annotations und komplexere Layoutregeln ergänzen.
