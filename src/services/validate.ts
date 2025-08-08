import type { ProcessJson } from './types';

export function validateProcess(model: ProcessJson): string[] {
  const errs: string[] = [];
  const proc = model.process;
  const startEvents = proc.nodes.filter((n) => n.type === 'startEvent');
  const endEvents = proc.nodes.filter((n) => n.type === 'endEvent');

  if (startEvents.length < 1) errs.push('Kein Start-Event gefunden');
  if (endEvents.length < 1) errs.push('Kein End-Event gefunden');

  // offene Gateways (hier sehr einfach: Gateway muss genau 1 Eingang und >=1 Ausgang haben oder umgekehrt)
  const gateways = proc.nodes.filter((n) => n.type === 'exclusiveGateway');
  for (const g of gateways) {
    const incoming = proc.flows.filter((f) => f.target === g.id).length;
    const outgoing = proc.flows.filter((f) => f.source === g.id).length;
    if (incoming === 0 || outgoing === 0) errs.push(`Gateway ${g.id} hat offene Kanten`);
  }

  // Sequenzflüsse konsistent
  for (const f of proc.flows) {
    const s = proc.nodes.find((n) => n.id === f.source);
    const t = proc.nodes.find((n) => n.id === f.target);
    if (!s || !t) errs.push(`Flow ${f.id} verweist auf unbekannte Knoten`);
  }

  return errs;
}
