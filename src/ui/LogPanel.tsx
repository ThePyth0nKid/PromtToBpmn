import React, { useMemo, useState } from 'react';
import type { RunEvent, RunStatus } from '../services/runner';

type Props = { events: RunEvent[] };

export default function LogPanel({ events }: Props): JSX.Element {
  const [filter, setFilter] = useState<RunStatus | 'all'>('all');
  const filtered = useMemo(
    () => (filter === 'all' ? events : events.filter((e) => e.status === filter)),
    [events, filter],
  );
  return (
    <div className="card p-3 h-64 overflow-auto">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium">Protokoll</div>
        <select className="input max-w-40" value={filter} onChange={(e) => setFilter(e.target.value as any)}>
          <option value="all">Alle</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="success">Success</option>
          <option value="failure">Failure</option>
        </select>
      </div>
      <ul className="space-y-1 text-sm">
        {filtered.map((e, i) => (
          <li key={i} className="flex items-center justify-between gap-3">
            <span className={`run-badge ${e.status}`}>{e.status}</span>
            <span className="truncate">{e.elementId}</span>
            <span className="text-muted">{new Date(e.timestamp).toLocaleTimeString()}</span>
            {typeof e.durationMs === 'number' && (
              <span className="text-muted">{e.durationMs} ms</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
