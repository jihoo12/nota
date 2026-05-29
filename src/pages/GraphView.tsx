import { useMemo, useState } from 'react';
import { useStore } from '../store/useStore';
import { buildGraphData } from '../utils/graph';
import './GraphView.css';

interface GraphViewProps {
  onOpenNote: (noteId: string) => void;
}

export function GraphView({ onOpenNote }: GraphViewProps) {
  const { notes, groups } = useStore();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const graph = useMemo(() => buildGraphData(notes, groups), [notes, groups]);
  const nodeMap = useMemo(() => new Map(graph.nodes.map(node => [node.id, node])), [graph.nodes]);
  const selectedNodeId = selectedGroupId ? `group:${selectedGroupId}` : null;
  const width = Math.max(900, ...graph.nodes.map(node => node.x + 180), 900);
  const height = Math.max(560, ...graph.nodes.map(node => node.y + 120), 560);
  const shorten = (label: string) => label.length > 18 ? `${label.slice(0, 17)}...` : label;

  return (
    <section className="graph-view">
      <header className="graph-view__header">
        <div>
          <p className="graph-view__eyebrow">Graph view</p>
          <h1 className="graph-view__title">Connections</h1>
        </div>
        <div className="graph-view__stats">
          <span>{notes.length} notes</span>
          <span>{groups.length} groups</span>
          <span>{graph.edges.length} links</span>
        </div>
      </header>

      {graph.nodes.length === 0 ? (
        <div className="graph-view__empty">Create notes and groups to see your graph.</div>
      ) : (
        <div className="graph-canvas" role="img" aria-label="Graph of notes, groups, and mentions">
          <svg className="graph-canvas__svg" viewBox={`0 0 ${width} ${height}`}>
            <defs>
              <marker id="graph-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                <path d="M0 0 L8 4 L0 8 Z" />
              </marker>
            </defs>

            {graph.edges.map(edge => {
              const source = nodeMap.get(edge.sourceId);
              const target = nodeMap.get(edge.targetId);
              if (!source || !target) return null;

              return (
                <line
                  key={edge.id}
                  className={`graph-edge graph-edge--${edge.kind}`}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  markerEnd="url(#graph-arrow)"
                />
              );
            })}

            {graph.nodes.map(node => {
              const rawId = node.id.split(':')[1];
              const isSelected = selectedNodeId === node.id;

              return (
                <g
                  key={node.id}
                  className={`graph-node graph-node--${node.kind}${isSelected ? ' graph-node--selected' : ''}`}
                  transform={`translate(${node.x}, ${node.y})`}
                  onClick={() => {
                    if (node.kind === 'note') onOpenNote(rawId);
                    if (node.kind === 'group') setSelectedGroupId(isSelected ? null : rawId);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    if (node.kind === 'note') onOpenNote(rawId);
                    if (node.kind === 'group') setSelectedGroupId(isSelected ? null : rawId);
                  }}
                >
                  <circle r={34} />
                  <text className="graph-node__kind" y="-5">{node.kind}</text>
                  <text className="graph-node__label" y="14">{shorten(node.label)}</text>
                </g>
              );
            })}
          </svg>
        </div>
      )}
    </section>
  );
}
