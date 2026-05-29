import { useMemo, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import type { Group, Note } from '../types';
import { findMentionTarget, parseMentions } from '../utils/mentions';
import './GraphView.css';

interface GraphViewProps {
  onOpenNote: (noteId: string) => void;
}

type GraphNodeKind = 'note' | 'group';

interface GraphNode {
  id: string;
  rawId: string;
  kind: GraphNodeKind;
  label: string;
  x: number;
  y: number;
  r: number;
  nested: boolean;
  depth: number;
}

export function GraphView({ onOpenNote }: GraphViewProps) {
  const { notes, groups } = useStore();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    panX: number;
    panY: number;
  } | null>(null);

  const graph = useMemo(() => {
    const groupIds = new Set(groups.map(group => group.id));
    const childGroupsByParent = new Map<string | null, Group[]>();
    const containedNotesByGroup = new Map<string, Note[]>();

    const mentionTargetsByNote = new Map<string, Array<{ kind: 'note' | 'group'; id: string }>>();
    notes.forEach(note => {
      const targets = parseMentions(note.content)
        .map(mention => {
          const target = findMentionTarget(mention, notes, groups);
          return target ? { kind: mention.kind, id: target.id } : null;
        })
        .filter((target): target is { kind: 'note' | 'group'; id: string } => Boolean(target));
      mentionTargetsByNote.set(note.id, targets);
    });

    const shouldNestNote = (note: Note) => {
      if (!note.groupId) return false;
      return !mentionTargetsByNote.get(note.id)?.some(target => (
        target.kind === 'group' && target.id === note.groupId
      ));
    };

    groups.forEach(group => {
      const parentId = group.parentGroupId && groupIds.has(group.parentGroupId)
        ? group.parentGroupId
        : null;
      const siblings = childGroupsByParent.get(parentId) ?? [];
      siblings.push(group);
      childGroupsByParent.set(parentId, siblings);
    });

    notes.forEach(note => {
      if (!shouldNestNote(note) || !note.groupId) return;
      const contained = containedNotesByGroup.get(note.groupId) ?? [];
      contained.push(note);
      containedNotesByGroup.set(note.groupId, contained);
    });

    const radiusCache = new Map<string, number>();
    const childGap = 28;
    const parentPadding = 42;
    const getRequiredOrbitRadius = (radii: number[]) => {
      if (radii.length <= 1) return 0;
      const sorted = [...radii].sort((a, b) => b - a);
      const widestPair = sorted[0] + (sorted[1] ?? sorted[0]) + childGap;
      return widestPair / (2 * Math.sin(Math.PI / radii.length));
    };

    const getGroupRadius = (groupId: string, visited = new Set<string>()): number => {
      const cached = radiusCache.get(groupId);
      if (cached) return cached;
      if (visited.has(groupId)) return 88;

      const nextVisited = new Set(visited);
      nextVisited.add(groupId);

      const children = childGroupsByParent.get(groupId) ?? [];
      const childRadii = children.map(child => getGroupRadius(child.id, nextVisited));
      const containedNoteCount = containedNotesByGroup.get(groupId)?.length ?? 0;
      const itemRadii = [...childRadii, ...Array(containedNoteCount).fill(25)];
      const largestItemRadius = Math.max(0, ...itemRadii);
      const singleItemRadius = itemRadii.length === 1 ? largestItemRadius + parentPadding + 26 : 0;
      const packedItemsRadius = itemRadii.length > 1
        ? getRequiredOrbitRadius(itemRadii) + largestItemRadius + parentPadding
        : 0;
      const radius = Math.max(88, singleItemRadius, packedItemsRadius);

      radiusCache.set(groupId, radius);
      return radius;
    };

    const groupNodes: GraphNode[] = [];
    const noteNodes: GraphNode[] = [];

    const placeContainedItems = (group: Group, groupNode: GraphNode, depth: number) => {
      const childGroups = childGroupsByParent.get(group.id) ?? [];
      const childNotes = containedNotesByGroup.get(group.id) ?? [];
      const items = [
        ...childGroups.map(child => ({ kind: 'group' as const, group: child, r: getGroupRadius(child.id) })),
        ...childNotes.map(note => ({ kind: 'note' as const, note, r: 25 })),
      ];
      const largestItemRadius = Math.max(0, ...items.map(item => item.r));
      const orbitRadius = items.length <= 1
        ? Math.max(0, Math.min(groupNode.r * 0.32, groupNode.r - largestItemRadius - parentPadding))
        : Math.max(
            getRequiredOrbitRadius(items.map(item => item.r)),
            groupNode.r - largestItemRadius - parentPadding,
          );

      items.forEach((item, index) => {
        const angle = items.length === 1
          ? Math.PI / 2
          : (Math.PI / 2) + (index / items.length) * Math.PI * 2;
        const x = groupNode.x + Math.cos(angle) * orbitRadius;
        const y = groupNode.y + Math.sin(angle) * orbitRadius;

        if (item.kind === 'group') {
          placeGroup(item.group, x, y, depth + 1);
          return;
        }

        noteNodes.push({
          id: `note:${item.note.id}`,
          rawId: item.note.id,
          kind: 'note',
          label: item.note.title || 'Untitled',
          x,
          y,
          r: item.r,
          nested: true,
          depth: depth + 1,
        });
      });
    };

    const placeGroup = (group: Group, x: number, y: number, depth = 0) => {
      const node: GraphNode = {
        id: `group:${group.id}`,
        rawId: group.id,
        kind: 'group',
        label: group.name || 'Untitled group',
        x,
        y,
        r: getGroupRadius(group.id),
        nested: depth > 0,
        depth,
      };
      groupNodes.push(node);
      placeContainedItems(group, node, depth);
    };

    const rootGroups = childGroupsByParent.get(null) ?? [];
    const maxRootRadius = Math.max(88, ...rootGroups.map(group => getGroupRadius(group.id)));
    const rootColumns = Math.max(1, Math.ceil(Math.sqrt(rootGroups.length || 1)));
    const rootRows = rootGroups.length > 0 ? Math.ceil(rootGroups.length / rootColumns) : 0;
    const rootCellWidth = Math.max(280, maxRootRadius * 2 + 86);
    const rootCellHeight = Math.max(235, maxRootRadius * 2 + 86);

    rootGroups.forEach((group, index) => {
      const radius = getGroupRadius(group.id);
      const x = 60 + maxRootRadius + (index % rootColumns) * rootCellWidth;
      const y = 60 + radius + Math.floor(index / rootColumns) * rootCellHeight;
      placeGroup(group, x, y);
    });

    const standaloneNotes = notes.filter(note => !shouldNestNote(note));
    const noteStartY = rootGroups.length > 0 ? 100 + rootRows * rootCellHeight : 145;
    const visibleNoteNodes = standaloneNotes.map((note, index) => ({
      id: `note:${note.id}`,
      rawId: note.id,
      kind: 'note' as const,
      label: note.title || 'Untitled',
      x: 150 + (index % 4) * 220,
      y: noteStartY + Math.floor(index / 4) * 145,
      r: 34,
      nested: false,
      depth: 0,
    }));

    noteNodes.unshift(...visibleNoteNodes);
    const nodeMap = new Map<string, GraphNode>([...groupNodes, ...noteNodes].map(node => [node.id, node]));

    const mentionEdges = notes.flatMap(note => {
      const sourceId = `note:${note.id}`;
      return (mentionTargetsByNote.get(note.id) ?? []).map((target, index) => ({
        id: `mentions:${note.id}:${target.kind}:${target.id}:${index}`,
        kind: 'mentions' as const,
        sourceId,
        targetId: `${target.kind}:${target.id}`,
      }));
    }).filter(edge => (
      edge.sourceId !== edge.targetId &&
      nodeMap.has(edge.sourceId) &&
      nodeMap.has(edge.targetId)
    ));

    return {
      groupNodes,
      noteNodes,
      nodeMap,
      edges: mentionEdges,
    };
  }, [notes, groups]);

  const selectedNodeId = selectedGroupId ? `group:${selectedGroupId}` : null;
  const allNodes = [...graph.groupNodes, ...graph.noteNodes];
  const width = Math.max(900, ...allNodes.map(node => node.x + node.r + 90), 900);
  const height = Math.max(560, ...allNodes.map(node => node.y + node.r + 90), 560);
  const shorten = (label: string) => label.length > 18 ? `${label.slice(0, 17)}...` : label;
  const clampZoom = (nextZoom: number) => Math.min(2.4, Math.max(0.45, nextZoom));
  const updateZoom = (delta: number) => setZoom(currentZoom => clampZoom(currentZoom + delta));
  const resetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const edgePoints = (sourceId: string, targetId: string) => {
    const source = graph.nodeMap.get(sourceId);
    const target = graph.nodeMap.get(targetId);
    if (!source || !target) return null;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.hypot(dx, dy) || 1;
    const startPad = source.r + 6;
    const endPad = target.r + 10;

    return {
      x1: source.x + (dx / length) * startPad,
      y1: source.y + (dy / length) * startPad,
      x2: target.x - (dx / length) * endPad,
      y2: target.y - (dy / length) * endPad,
    };
  };

  return (
    <section className="graph-view">
      <div className="graph-canvas">
        <header className="graph-view__header">
          <div>
            <p className="graph-view__eyebrow">Graph view</p>
            <h1 className="graph-view__title">Connections</h1>
          </div>
          <div className="graph-view__header-actions">
            <div className="graph-view__stats">
              <span>{notes.length} notes</span>
              <span>{groups.length} groups</span>
              <span>{graph.edges.length} mentions</span>
            </div>
            <div className="graph-view__zoom" aria-label="Graph zoom controls">
              <button type="button" onClick={() => updateZoom(-0.15)} aria-label="Zoom out">-</button>
              <span>{Math.round(zoom * 100)}%</span>
              <button type="button" onClick={() => updateZoom(0.15)} aria-label="Zoom in">+</button>
              <button type="button" onClick={resetZoom} aria-label="Reset zoom">Reset</button>
            </div>
          </div>
        </header>

        {allNodes.length === 0 ? (
          <div className="graph-view__empty">Create notes and groups to see your graph.</div>
        ) : (
          <div
            ref={surfaceRef}
            className={`graph-canvas__surface${isPanning ? ' graph-canvas__surface--panning' : ''}`}
            role="img"
            aria-label="Graph of notes, groups, and mentions"
            onMouseDown={event => {
              if (event.button === 1) event.preventDefault();
            }}
            onPointerDown={event => {
              if (event.button !== 1 || !surfaceRef.current) return;
              event.preventDefault();
              panStartRef.current = {
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                panX: pan.x,
                panY: pan.y,
              };
              event.currentTarget.setPointerCapture(event.pointerId);
              setIsPanning(true);
            }}
            onPointerMove={event => {
              const panStart = panStartRef.current;
              if (!panStart || panStart.pointerId !== event.pointerId) return;
              event.preventDefault();
              setPan({
                x: panStart.panX + event.clientX - panStart.x,
                y: panStart.panY + event.clientY - panStart.y,
              });
            }}
            onPointerUp={event => {
              const panStart = panStartRef.current;
              if (!panStart || panStart.pointerId !== event.pointerId) return;
              panStartRef.current = null;
              event.currentTarget.releasePointerCapture(event.pointerId);
              setIsPanning(false);
            }}
            onPointerCancel={event => {
              panStartRef.current = null;
              setIsPanning(false);
            }}
            onAuxClick={event => {
              if (event.button === 1) event.preventDefault();
            }}
            onWheel={event => {
              if (!event.ctrlKey && !event.metaKey) return;
              event.preventDefault();
              updateZoom(event.deltaY > 0 ? -0.08 : 0.08);
            }}
          >
          <svg
            className="graph-canvas__svg"
            style={{
              width: width * zoom,
              height: height * zoom,
              transform: `translate(${pan.x}px, ${pan.y}px)`,
            }}
            viewBox={`0 0 ${width} ${height}`}
          >
            <defs>
              <marker id="graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0 0 L8 4 L0 8 Z" />
              </marker>
            </defs>

            <g className="graph-groups">
              {graph.groupNodes.map(node => {
                const isSelected = selectedNodeId === node.id;
                return (
                  <g
                    key={node.id}
                    className={`graph-node graph-node--group${node.nested ? ' graph-node--nested-group' : ''}${isSelected ? ' graph-node--selected' : ''}`}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => setSelectedGroupId(isSelected ? null : node.rawId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={event => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      setSelectedGroupId(isSelected ? null : node.rawId);
                    }}
                  >
                    <circle r={node.r} />
                    <text className="graph-node__kind" y={-node.r + 24}>group</text>
                    <text className="graph-node__label graph-node__label--group" y={-node.r + 43}>{shorten(node.label)}</text>
                  </g>
                );
              })}
            </g>

            {graph.edges.map(edge => {
              const points = edgePoints(edge.sourceId, edge.targetId);
              if (!points) return null;

              return (
                <line
                  key={edge.id}
                  className={`graph-edge graph-edge--${edge.kind}`}
                  x1={points.x1}
                  y1={points.y1}
                  x2={points.x2}
                  y2={points.y2}
                  markerEnd="url(#graph-arrow)"
                />
              );
            })}

            <g className="graph-notes">
              {graph.noteNodes.map(node => {
                return (
                  <g
                    key={node.id}
                    className={`graph-node graph-node--note${node.nested ? ' graph-node--nested' : ''}`}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => onOpenNote(node.rawId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={event => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      onOpenNote(node.rawId);
                    }}
                  >
                    <circle r={node.r} />
                    <text className="graph-node__kind" y={node.nested ? -2 : -5}>note</text>
                    <text className="graph-node__label" y={node.nested ? 12 : 14}>{shorten(node.label)}</text>
                  </g>
                );
              })}
            </g>
          </svg>
          </div>
        )}
      </div>
    </section>
  );
}
