import React from 'react';
import VoiceInput from './VoiceInput';

type Props = {
  value: string;
  onChange: (val: string) => void;
  onGenerate: () => void | Promise<void>;
  onImprove: () => void | Promise<void>;
  loading?: boolean;
  errors?: string[];
};

export default function PromptPanel({ value, onChange, onGenerate, onImprove, loading, errors = [] }: Props): JSX.Element {
  return (
    <div className="flex h-full flex-col gap-3">
      <label className="text-sm text-muted" htmlFor="prompt">
        Prozessbeschreibung (natürliche Sprache)
      </label>
      <textarea
        id="prompt"
        className="input min-h-[240px] flex-1"
        placeholder={
          'Beispiel: Wenn eine neue Bestellung eingeht, prüfe den Lagerbestand, reserviere Artikel, sende Bestellbestätigung, starte Versandvorbereitung und schließe den Prozess ab.'
        }
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <VoiceInput onTranscript={(t) => onChange(t)} />
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
    </div>
  );
}
