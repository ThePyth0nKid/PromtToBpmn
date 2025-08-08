import type { ProcessJson, ProcessModel, ProcessNode, SequenceFlow } from './types';

function xmlEscape(input: string | undefined): string {
  if (!input) return '';
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

type Bounds = { x: number; y: number; w: number; h: number };

const CENTER_X = 500;
const COLUMN_OFFSET = 260;
const V_GAP = 140;
const EDGE_DROP = 20;

function sizeFor(node: ProcessNode): { w: number; h: number } {
  if (node.type === 'task') return { w: 150, h: 90 };
  if (node.type === 'exclusiveGateway') return { w: 50, h: 50 };
  return { w: 36, h: 36 }; // start/end
}

function findStartId(proc: ProcessModel): string {
  const start = proc.nodes.find((n) => n.type === 'startEvent');
  return start ? start.id : proc.nodes[0]?.id;
}

function buildMaps(proc: ProcessModel) {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const n of proc.nodes) {
    outgoing.set(n.id, []);
    incoming.set(n.id, []);
  }
  for (const f of proc.flows) {
    if (!outgoing.has(f.source)) outgoing.set(f.source, []);
    if (!incoming.has(f.target)) incoming.set(f.target, []);
    outgoing.get(f.source)!.push(f.target);
    incoming.get(f.target)!.push(f.source);
  }
  return { outgoing, incoming };
}

// Longest-path level assignment for clearer layering across branches
function computeLevels(proc: ProcessModel, maps: { outgoing: Map<string, string[]>; incoming: Map<string, string[]> }, startId: string): Map<string, number> {
  const { outgoing, incoming } = maps;
  // Kahn topological order (best-effort; if cycles, fallback to BFS-like)
  const indeg = new Map<string, number>();
  proc.nodes.forEach((n) => indeg.set(n.id, (incoming.get(n.id) ?? []).length));
  const q: string[] = [];
  if (indeg.get(startId) !== undefined) q.push(startId);
  const order: string[] = [];
  const seen = new Set<string>();
  while (q.length) {
    const u = q.shift()!;
    if (seen.has(u)) continue;
    seen.add(u);
    order.push(u);
    for (const v of outgoing.get(u) ?? []) {
      indeg.set(v, (indeg.get(v) ?? 1) - 1);
      if ((indeg.get(v) ?? 0) <= 0) q.push(v);
    }
  }
  // Add remaining
  for (const n of proc.nodes) if (!seen.has(n.id)) order.push(n.id);

  const level = new Map<string, number>();
  level.set(startId, 0);
  for (const id of order) {
    const parents = incoming.get(id) ?? [];
    if (parents.length === 0) {
      if (!level.has(id)) level.set(id, id === startId ? 0 : 0);
    } else {
      let maxParent = 0;
      for (const p of parents) maxParent = Math.max(maxParent, (level.get(p) ?? 0) + 1);
      level.set(id, maxParent);
    }
  }
  // Fallback for missing
  for (const n of proc.nodes) if (!level.has(n.id)) level.set(n.id, 0);
  return level;
}

function assignColumns(proc: ProcessModel, maps: { outgoing: Map<string, string[]>; incoming: Map<string, string[]> }, startId: string): Map<string, number> {
  const { outgoing, incoming } = maps;
  const col = new Map<string, number>();

  const offsetSeq = (k: number): number[] => {
    const arr: number[] = [];
    let step = 1;
    for (let i = 0; i < k; i++) {
      arr.push(i % 2 === 0 ? -step : step);
      if (i % 2 === 1) step++;
    }
    return arr;
  };

  const visit = (nodeId: string, currentCol: number) => {
    if (!col.has(nodeId)) col.set(nodeId, currentCol);
    const outs = outgoing.get(nodeId) ?? [];
    if (outs.length <= 1) {
      if (outs[0]) visit(outs[0], currentCol);
      return;
    }
    // split: distribute relative to current column
    const offs = offsetSeq(outs.length);
    outs.forEach((child, idx) => visit(child, currentCol + offs[idx]));
  };

  visit(startId, 0);

  // Rejoin centering: nodes with >1 incoming → set to average of parents
  for (const n of proc.nodes) {
    const ins = incoming.get(n.id) ?? [];
    if (ins.length > 1) {
      const avg = ins.reduce((s, p) => s + (col.get(p) ?? 0), 0) / ins.length;
      const centered = Math.round(avg);
      col.set(n.id, centered);
    }
  }

  // Fallback for any missing
  for (const n of proc.nodes) if (!col.has(n.id)) col.set(n.id, 0);
  return col;
}

function computeBounds(proc: ProcessModel): Map<string, Bounds> {
  const maps = buildMaps(proc);
  const startId = findStartId(proc);
  const levels = computeLevels(proc, maps, startId);
  const cols = assignColumns(proc, maps, startId);

  const bounds = new Map<string, Bounds>();
  proc.nodes.forEach((n) => {
    const { w, h } = sizeFor(n);
    const level = levels.get(n.id) ?? 0;
    const col = cols.get(n.id) ?? 0;
    const xCenter = CENTER_X + col * COLUMN_OFFSET;
    const yTop = 80 + level * V_GAP;
    bounds.set(n.id, { x: Math.round(xCenter - w / 2), y: Math.round(yTop), w, h });
  });
  return bounds;
}

function edgeWaypoints(bounds: Map<string, Bounds>, f: SequenceFlow): string {
  const s = bounds.get(f.source)!;
  const t = bounds.get(f.target)!;
  const sx = Math.round(s.x + s.w / 2);
  const sy = Math.round(s.y + s.h);
  const tx = Math.round(t.x + t.w / 2);
  const ty = Math.round(t.y);
  if (sx === tx) {
    return `<di:waypoint x="${sx}" y="${sy}" /><di:waypoint x="${tx}" y="${ty}" />`;
  }
  const midY = Math.round(Math.min(ty, sy) + EDGE_DROP + Math.abs(ty - sy) * 0.2);
  return `<di:waypoint x="${sx}" y="${sy}" /><di:waypoint x="${sx}" y="${midY}" /><di:waypoint x="${tx}" y="${midY}" /><di:waypoint x="${tx}" y="${ty}" />`;
}

export function jsonToBpmnXml(model: ProcessJson): string {
  const proc = model.process;
  const defsId = 'Definitions_1';
  const planeId = 'BPMNPlane_1';
  const diagramId = 'BPMNDiagram_1';

  const header = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n` +
    `<bpmn:definitions xmlns:xsi=\"http://www.w3.org/2001/XMLSchema-instance\" xmlns:bpmn=\"http://www.omg.org/spec/BPMN/20100524/MODEL\" xmlns:bpmndi=\"http://www.omg.org/spec/BPMN/20100524/DI\" xmlns:dc=\"http://www.omg.org/spec/DD/20100524/DC\" xmlns:di=\"http://www.omg.org/spec/DD/20100524/DI\" id=\"${defsId}\" targetNamespace=\"http://bpmn.io/schema/bpmn\">`;

  const nodesXml = proc.nodes
    .map((n) => {
      const nameAttr = n.name ? ` name=\"${xmlEscape(n.name)}\"` : '';
      if (n.type === 'startEvent') return `<bpmn:startEvent id=\"${n.id}\"${nameAttr} />`;
      if (n.type === 'endEvent') return `<bpmn:endEvent id=\"${n.id}\"${nameAttr} />`;
      if (n.type === 'exclusiveGateway') return `<bpmn:exclusiveGateway id=\"${n.id}\"${nameAttr} />`;
      return `<bpmn:task id=\"${n.id}\"${nameAttr} />`;
    })
    .join('');

  const flowsXml = proc.flows
    .map((f) => `<bpmn:sequenceFlow id=\"${f.id}\" sourceRef=\"${f.source}\" targetRef=\"${f.target}\" />`)
    .join('');

  const processXml = `<bpmn:process id=\"${proc.id}\" isExecutable=\"false\">${nodesXml}${flowsXml}</bpmn:process>`;

  const bmap = computeBounds(proc);
  const shapesXml = proc.nodes
    .map((n) => {
      const b = bmap.get(n.id)!;
      return `<bpmndi:BPMNShape id=\"${n.id}_di\" bpmnElement=\"${n.id}\"><dc:Bounds x=\"${b.x}\" y=\"${b.y}\" width=\"${b.w}\" height=\"${b.h}\" /></bpmndi:BPMNShape>`;
    })
    .join('');

  const edgesXml = proc.flows
    .map((f) => `<bpmndi:BPMNEdge id=\"${f.id}_di\" bpmnElement=\"${f.id}\">${edgeWaypoints(bmap, f)}</bpmndi:BPMNEdge>`)
    .join('');

  const diXml = `<bpmndi:BPMNDiagram id=\"${diagramId}\"><bpmndi:BPMNPlane id=\"${planeId}\" bpmnElement=\"${proc.id}\">${shapesXml}${edgesXml}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>`;

  const footer = `</bpmn:definitions>`;

  return header + processXml + diXml + footer;
}
