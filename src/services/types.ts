export type NodeType = 'startEvent' | 'task' | 'endEvent' | 'exclusiveGateway';

export type ProcessNode = {
  id: string;
  type: NodeType;
  name?: string;
};

export type SequenceFlow = {
  id: string;
  source: string;
  target: string;
};

export type ProcessModel = {
  id: string;
  name?: string;
  nodes: ProcessNode[];
  flows: SequenceFlow[];
};

export type ProcessJson = {
  process: ProcessModel;
};
