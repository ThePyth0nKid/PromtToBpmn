import type { ProcessJson, ProcessNode } from './types';

function xmlEscape(input: string | undefined): string {
  if (!input) return '';
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function nodeBounds(node: ProcessNode, index: number) {
  const x = 200;
  const y = 100 + index * 120;
  if (node.type === 'task') return { x, y, w: 120, h: 80 };
  if (node.type === 'startEvent' || node.type === 'endEvent') return { x, y, w: 36, h: 36 };
  if (node.type === 'exclusiveGateway') return { x, y, w: 50, h: 50 };
  return { x, y, w: 100, h: 80 };
}

export function jsonToBpmnXml(model: ProcessJson): string {
  const proc = model.process;
  const defsId = 'Definitions_1';
  const planeId = 'BPMNPlane_1';
  const diagramId = 'BPMNDiagram_1';

  const header = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="${defsId}" targetNamespace="http://bpmn.io/schema/bpmn">`;

  const nodesXml = proc.nodes
    .map((n) => {
      const nameAttr = n.name ? ` name="${xmlEscape(n.name)}"` : '';
      if (n.type === 'startEvent') return `<bpmn:startEvent id="${n.id}"${nameAttr} />`;
      if (n.type === 'endEvent') return `<bpmn:endEvent id="${n.id}"${nameAttr} />`;
      if (n.type === 'exclusiveGateway') return `<bpmn:exclusiveGateway id="${n.id}"${nameAttr} />`;
      return `<bpmn:task id="${n.id}"${nameAttr} />`;
    })
    .join('');

  const flowsXml = proc.flows
    .map((f) => `<bpmn:sequenceFlow id="${f.id}" sourceRef="${f.source}" targetRef="${f.target}" />`)
    .join('');

  const processXml = `<bpmn:process id="${proc.id}" isExecutable="false">${nodesXml}${flowsXml}</bpmn:process>`;

  const shapesXml = proc.nodes
    .map((n, i) => {
      const b = nodeBounds(n, i);
      return `<bpmndi:BPMNShape id="${n.id}_di" bpmnElement="${n.id}"><dc:Bounds x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" /></bpmndi:BPMNShape>`;
    })
    .join('');

  const edgesXml = proc.flows
    .map((f) => {
      const srcIndex = proc.nodes.findIndex((n) => n.id === f.source);
      const tgtIndex = proc.nodes.findIndex((n) => n.id === f.target);
      const s = nodeBounds(proc.nodes[srcIndex], srcIndex);
      const t = nodeBounds(proc.nodes[tgtIndex], tgtIndex);
      const sx = s.x + s.w;
      const sy = s.y + s.h / 2;
      const tx = t.x;
      const ty = t.y + t.h / 2;
      return `<bpmndi:BPMNEdge id="${f.id}_di" bpmnElement="${f.id}"><di:waypoint x="${sx}" y="${sy}" /><di:waypoint x="${tx}" y="${ty}" /></bpmndi:BPMNEdge>`;
    })
    .join('');

  const diXml = `<bpmndi:BPMNDiagram id="${diagramId}"><bpmndi:BPMNPlane id="${planeId}" bpmnElement="${proc.id}">${shapesXml}${edgesXml}</bpmndi:BPMNPlane></bpmndi:BPMNDiagram>`;

  const footer = `</bpmn:definitions>`;

  return header + processXml + diXml + footer;
}
