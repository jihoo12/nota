import { Group, Note } from '../types';
import { findMentionTarget, parseMentions } from './mentions';

export type GraphNodeKind = 'note' | 'group';
export type GraphEdgeKind = 'contains' | 'mentions';

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  label: string;
  x: number;
  y: number;
}

export interface GraphEdge {
  id: string;
  kind: GraphEdgeKind;
  sourceId: string;
  targetId: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const nodeId = (kind: GraphNodeKind, id: string) => `${kind}:${id}`;

export function getGraphNodeId(kind: GraphNodeKind, id: string) {
  return nodeId(kind, id);
}

export function buildGraphData(notes: Note[], groups: Group[]): GraphData {
  const columns = Math.max(2, Math.ceil(Math.sqrt(notes.length + groups.length || 1)));
  const nodes: GraphNode[] = [
    ...groups.map((group, index) => ({
      id: nodeId('group', group.id),
      kind: 'group' as const,
      label: group.name || 'Untitled group',
      x: 120 + (index % columns) * 220,
      y: 110 + Math.floor(index / columns) * 160,
    })),
    ...notes.map((note, index) => ({
      id: nodeId('note', note.id),
      kind: 'note' as const,
      label: note.title || 'Untitled',
      x: 120 + ((index + groups.length) % columns) * 220,
      y: 110 + Math.floor((index + groups.length) / columns) * 160,
    })),
  ];

  const edges: GraphEdge[] = [];

  groups.forEach(group => {
    if (!group.parentGroupId) return;
    edges.push({
      id: `contains:group:${group.parentGroupId}:${group.id}`,
      kind: 'contains',
      sourceId: nodeId('group', group.parentGroupId),
      targetId: nodeId('group', group.id),
    });
  });

  notes.forEach(note => {
    if (note.groupId) {
      edges.push({
        id: `contains:note:${note.groupId}:${note.id}`,
        kind: 'contains',
        sourceId: nodeId('group', note.groupId),
        targetId: nodeId('note', note.id),
      });
    }

    parseMentions(note.content).forEach((mention, index) => {
      const target = findMentionTarget(mention, notes, groups);
      if (!target) return;

      edges.push({
        id: `mentions:${note.id}:${mention.kind}:${target.id}:${index}`,
        kind: 'mentions',
        sourceId: nodeId('note', note.id),
        targetId: nodeId(mention.kind, target.id),
      });
    });
  });

  return { nodes, edges };
}
