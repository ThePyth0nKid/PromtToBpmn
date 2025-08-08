import React from 'react';
import type { RunEvent } from '../services/runner';

type Props = {
  openedId?: string | null;
  onClose: () => void;
  history: RunEvent[];
};

export default function DetailsPanel({ openedId, onClose, history }: Props): JSX.Element {
  const list = history.filter((h) => h.elementId === openedId);
  return (
    <aside className="card p-3 h-full w-full">
      <div className="flex items-center justify-between mb-2">
        <div className="font-medium">Details</div>
        <button className="btn" onClick={onClose}>Schließen</button>
      </div>
      {!openedId ? (
        <div className="text-sm text-muted">Wähle einen Schritt im Diagramm aus</div>
      ) : (
        <div className="space-y-2 text-sm">
          <div><span className="text-muted">Element:</span> {openedId}</div>
          <div className="text-muted">Historie:</div>
          <ul className="space-y-1">
            {list.map((e, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className={`run-badge ${e.status}`}>{e.status}</span>
                <span>{new Date(e.timestamp).toLocaleTimeString()}</span>
                {typeof e.durationMs === 'number' && <span>{e.durationMs} ms</span>}
                {e.message && <span className="text-muted">{e.message}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  );
}
