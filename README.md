# Prompt-to-BPMN (React + Vite + TypeScript + Tailwind v4 + bpmn-js)

Eine minimalistische, produktionsreife React-App, die natürliche Sprache (Text/Voice) in BPMN 2.0 umwandelt und das Diagramm im Browser rendert. Fokus: zuverlässige Pipeline, deterministische Abbildung, klare Developer Experience.

## Architekturüberblick

Voice/Text → LLM → kompakte JSON-Zwischenrepräsentation → deterministischer Mapper → BPMN 2.0 XML → Render in bpmn-js

- Eingabe: Großes Textfeld und optional Mikrofon (Web Speech API). Live-Transkript landet im Textfeld.
- Verarbeitung:
  - `textToProcessJson(prompt)` erzeugt eine kompakte, block-orientierte JSON-Struktur (LLM oder Mock).
  - `jsonToBpmnXml(json)` mappt deterministisch zu validem BPMN 2.0 XML (inkl. DI für bpmn-js).
- Rendering: `bpmn-js` (Modeler) importiert XML und zeigt das Diagramm. Auto-Fit/Zoom-to-fit nach Import.
- Validierung: Start-/End-Event, offene Gateways, Sequenzfluss-Konsistenz. Fehler werden angezeigt. „Verbessern“ stößt erneute LLM-Runde mit Fehlerkontext an.

## Voraussetzungen

- Node.js: Empfohlen Node 20 LTS (≥ 20.0)
- Paketmanager: npm oder pnpm (empfohlen)

Prüfe Versionen:

```bash
node -v
npm -v
# optional
pnpm -v
```

## Installation

```bash
# im Projektverzeichnis
pnpm install
# oder
npm install
```

## Entwicklung starten

```bash
pnpm dev
# oder
npm run dev
```

- Öffne `http://localhost:5173`.
- Tailwind v4 ist aktiv (CSS-first Setup). Dark/Light Mode wird unterstützt.

## Build & Preview

```bash
pnpm build
pnpm preview
# oder
npm run build
npm run preview
```

## Lint & Format

```bash
pnpm lint
pnpm format
# oder
npm run lint
npm run format
```

## Tailwind CSS v4 Setup

Tailwind v4 nutzt ein CSS-first Modell. Keine `tailwind.config.js`. Alle Direktiven und das Theme liegen in `src/index.css`.

- `src/index.css` enthält:
  - `@import "tailwindcss";`
  - `@theme { ... }` (optionale Farb-, Font- und Token-Definitionen)
- Dark/Light Mode: via `.dark`-Klasse auf dem `<html>`-Element. Es gibt einen Toggle in der UI.

PostCSS ist bereits konfiguriert. Content-Erkennung erfolgt automatisch über Tailwind v4.

## Web Speech API (Voice Input)

- Feature-Detection zur Nutzung der Web Speech API (`SpeechRecognition`/`webkitSpeechRecognition`).
- Live-Transkript wird in das Haupt-Textfeld geschrieben.
- Fallback: Wenn die API nicht verfügbar ist, zeigt die UI einen Hinweis und ermöglicht weiterhin reine Texteingabe.

Hinweis: Browserunterstützung variiert (Chrome-basiert meist unterstützt). Siehe MDN für Details.

## bpmn-js Integration

- Es wird `bpmn-js/lib/Modeler` verwendet.
- Import: `modeler.importXML(xml)`
- Export: `modeler.saveXML({ format: true })`, `modeler.saveSVG()`
- Auto-Fit: Nach Import wird `zoomToFit()` aufgerufen.
- Fehlerrobustheit: try/catch beim Import/Export, UI zeigt Fehlerstatus.

## LLM/Mock-Konfiguration

- Die App nutzt einen Mock-LLM per Default (offline tauglich). Er erkennt einfache, sequentielle Schritte aus dem Prompt.
- Für echte LLM-Backends sind Stubs enthalten. Konfiguration via `.env`:

```env
# .env.example kopieren zu .env und Werte setzen
VITE_USE_MOCK=true
# Beispiel für echtes Backend (nicht benötigt für Demo)
VITE_LLM_PROVIDER=custom
VITE_LLM_API_URL=https://api.example.com/generate
VITE_LLM_API_KEY=sk-...
```

Sicherheitshinweis: Lege Secrets nie ins Repo. `.env` ist in `.gitignore` eingetragen.

## Git & GitHub Versionierung

Erst-Setup (in diesem Ordner):

```bash
git init
git add -A
git commit -m "chore: initial commit"
# Remote hinzufügen (ersetze <USER> und <REPO>)
git branch -M main
git remote add origin git@github.com:<USER>/<REPO>.git
# oder HTTPS
# git remote add origin https://github.com/<USER>/<REPO>.git

git push -u origin main
```

Kurz zu Branch-Strategie:
- `main`: stabile, releasbare Basis
- Feature-Branches: `feat/...`, `fix/...`, PR-Review, Squash-Merge empfohlen
- Tags/Releases optional für Versionierung

## Bekannte Limitierungen

- Parallelismus/Verzweigungen: Der Mock-Mapper generiert vor allem sequentielle Flüsse. Gateways werden konservativ behandelt.
- Layouting: Die DI-Koordinaten sind simpel (vertikale Liste). Für komplexe Modelle empfiehlt sich ein Auto-Layout-Plugin.
- Voice: Browserabhängigkeit der Web Speech API.

## „Verbessern“-Loop

- Bei Validierungsfehlern wird ein kompaktes Fehlerobjekt an `textToProcessJson` übergeben. Ein echtes LLM kann daraufhin die JSON-Struktur präzisieren.
- Der Mock führt bei „Verbessern“ erneut die gleiche Heuristik aus (Determinismus für Demo). In Produktion: echtes LLM mit strengen Output-Constraints verwenden.

---

## App-Features im Überblick

- Großes Prompt-Feld, Buttons: „Aufnehmen/Stop“, „Generieren“, „Verbessern“, „Export XML/PNG/SVG“
- bpmn-js Modeler mit Import/Export und Zoom-to-fit
- Tailwind v4, Dark/Light Mode
- ESLint/Prettier, Scripts: `dev`, `build`, `preview`, `lint`, `format`

---

## Schnellstart (Kompakt)

```bash
pnpm install
pnpm dev
# http://localhost:5173
```

Deployment: Baue mit `pnpm build`. Den Ordner `dist/` auf einen statischen Hoster (z. B. GitHub Pages, Netlify, Vercel) deployen.

---

## Befehle für den ersten Commit & GitHub Push

```bash
cd C:\\Users\\nelso\\Desktop\\PromtToBpmn
git init
git add -A
git commit -m "chore: initial commit"
git branch -M main
git remote add origin git@github.com:<USER>/<REPO>.git
# oder HTTPS:
# git remote add origin https://github.com/<USER>/<REPO>.git

git push -u origin main
```
