import React, { useState } from 'react';
import VoiceInput from './VoiceInput';
import { llmMode, testOpenRouterEcho, type LlmDiag } from '../services/llm';

type Props = {
  value: string;
  onChange: (val: string) => void;
  onGenerate: () => void | Promise<void>;
  onImprove: () => void | Promise<void>;
  loading?: boolean;
  errors?: string[];
};

export default function PromptPanel({ value, onChange, onGenerate, onImprove, loading, errors = [] }: Props): JSX.Element {
  const [echo, setEcho] = useState<string>('');
  const [diag, setDiag] = useState<LlmDiag | null>(null);
  const [testing, setTesting] = useState<boolean>(false);

  const doEchoTest = async () => {
    const mode = llmMode();
    if (mode.usingMock || mode.provider.toLowerCase() !== 'openrouter') {
      setEcho('Test ignoriert: Mock aktiv oder Provider ≠ openrouter');
      setDiag(null);
      return;
    }
    try {
      setTesting(true);
      const { diag, content } = await testOpenRouterEcho(value || 'ping');
      setDiag(diag);
      setEcho(content);
    } catch (e: any) {
      setEcho(e?.message ?? String(e));
      setDiag((e && e.diag) || null);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <label className="text-sm text-muted" htmlFor="prompt">
        Prozessbeschreibung (natürliche Sprache)
      </label>
      <textarea
        id="prompt"
        className="chat-input"
        placeholder={
          'Beispiel: Wenn eine neue Bestellung eingeht, prüfe den Lagerbestand, reserviere Artikel, sende Bestellbestätigung, starte Versandvorbereitung und schließe den Prozess ab.'
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <VoiceInput onTranscript={(t) => onChange(t)} />
          <button className="btn" onClick={doEchoTest} disabled={testing} title="Direkt-Test gegen OpenRouter">
            {testing ? 'Test…' : 'LLM Test'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={onImprove} disabled={loading}>
            Verbessern
          </button>
          <button className="btn btn-primary" onClick={onGenerate} disabled={loading}>
            {loading ? 'Generiere…' : 'Generieren'}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-border bg-muted p-3 text-sm text-red-600 dark:text-red-400">
          <div className="font-medium">Validierungsfehler</div>
          <ul className="list-disc pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {(echo || diag) && (
        <div className="rounded-md border border-border bg-muted p-3 text-xs">
          <div className="font-medium mb-1">LLM Test (Echo)</div>
          {diag && (
            <div className="mb-1">Status: {diag.ok ? 'OK' : 'ERROR'} {diag.status ?? ''} in {diag.durationMs ?? 0} ms {diag.requestId ? `(id ${diag.requestId})` : ''}</div>
          )}
          {echo && <pre className="overflow-auto whitespace-pre-wrap">{echo}</pre>}
        </div>
      )}
    </div>
  );
}
