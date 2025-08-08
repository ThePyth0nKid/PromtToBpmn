# Prompt-to-BPMN (React + Vite + TypeScript + Tailwind v4 + bpmn-js)

Eine minimalistische, produktionsreife React-App, die natürliche Sprache (Text/Voice) in BPMN 2.0 umwandelt, validiert und im Browser rendert. Für volle Details nutze bitte die neue, zweisprachige Dokumentation in `docs/`.

- Deutsch: `docs/de/README.md`
- English: `docs/en/README.md`

## Kurzüberblick

Voice/Text → LLM → kompakte JSON-Zwischenrepräsentation → deterministischer Mapper → BPMN 2.0 XML (+ DI/Auto-Layout) → Render in bpmn-js

- Eingabe: Prompt-Feld + optional Mikrofon (Web Speech API)
- Verarbeitung: `textToProcessJson(prompt)` (OpenRouter oder Mock) → `jsonToBpmnXml(json)` (deterministisch, Spaltenlayout, orthogonale Kanten)
- Rendering/Export: Import, Zoom-to-fit, Export XML/SVG/PNG
- Validierung: Start/End, Gateways, Sequenzflüsse; „Verbessern“-Loop
- Live-Run (Demo): Status-Markierungen, Log, Detail-Panel, Export `run.json`

## Schneller Start

```bash
npm install
npm run dev
# http://localhost:5173
```

Build/Preview/Lint/Format:

```bash
npm run build
npm run preview
npm run lint
npm run format
```

## LLM/Mock (Kurz)

`.env` (siehe `sample.env`) steuert, ob Mock oder OpenRouter verwendet wird:

```env
VITE_USE_MOCK=false
VITE_LLM_PROVIDER=openrouter
VITE_LLM_API_KEY=sk-or-v1-...
VITE_LLM_API_URL=https://openrouter.ai/api/v1/chat/completions
VITE_OPENROUTER_MODEL=openai/gpt-4o-mini
VITE_OPENROUTER_REFERER=http://localhost:5173
VITE_OPENROUTER_TITLE=Prompt-to-BPMN
```

Für eine ausführliche Anleitung (Architektur, Setup, Voice, Mapping, Layout, Validierung, Live-Run, Export und Troubleshooting) siehe:
- `docs/de/README.md`
- `docs/en/README.md`

## GitHub (Kurz)

```bash
git init
git add -A
git commit -m "chore: initial commit"
git branch -M main
git remote add origin <REMOTE>
git push -u origin main
```
