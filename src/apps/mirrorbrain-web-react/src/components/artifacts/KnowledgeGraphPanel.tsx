import type {
  KnowledgeGraphSnapshot,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
} from '../../types/index';
import { useEffect, useMemo, useState } from 'react';

type PositionedNode = KnowledgeGraphNode & {
  x: number;
  y: number;
  size: number;
  color: string;
};

export interface KnowledgeGraphPanelProps {
  /** Graph snapshot data from API */
  graph: KnowledgeGraphSnapshot;

  /** Callback when a topic node is clicked */
  onTopicClick?: (topicKey: string, node: KnowledgeGraphNode) => void;

  /** Callback when an artifact node is clicked */
  onArtifactClick?: (artifactId: string, node: KnowledgeGraphNode) => void;

  /** Layout algorithm for graph (to be used by visualization library) */
  layout?: 'fcose' | 'concentric' | 'breadthfirst' | 'circle' | 'grid';

  /** Whether to show SIMILAR edges (TF-IDF similarity relations) */
  showSimilarityEdges?: boolean;

  /** Whether to show REFERENCES edges (wikilink references) */
  showReferenceEdges?: boolean;

  /** Whether to show CONTAINS edges (topic-artifact hierarchy) */
  showContainsEdges?: boolean;

  /** Minimum similarity threshold for SIMILAR edges */
  minSimilarity?: number;

  /** Knowledge artifact id to place at the center of the rendered graph */
  focusArtifactId?: string;

  /** Display label for the centered knowledge artifact */
  focusArtifactTitle?: string;

  /** Custom className for styling */
  className?: string;
}

/**
 * Get filtered edges based on panel props
 */
function filterEdges(
  edges: KnowledgeGraphEdge[],
  props: KnowledgeGraphPanelProps,
): KnowledgeGraphEdge[] {
  const showContains = props.showContainsEdges ?? true;
  const showReferences = props.showReferenceEdges ?? true;
  const showSimilarity = props.showSimilarityEdges ?? true;
  const minSimilarity = props.minSimilarity ?? 0;

  return edges.filter((edge) => {
    if (edge.type === 'CONTAINS' && !showContains) return false;
    if (edge.type === 'REFERENCES' && !showReferences) return false;
    if (edge.type === 'SIMILAR') {
      if (!showSimilarity) return false;
      if (edge.properties.similarity !== undefined && edge.properties.similarity < minSimilarity) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Lightweight knowledge graph visualization inspired by the PulseOS-lite graph workspace.
 * MirrorBrain keeps this dependency-free for now: SVG gives us a real relation map without
 * adding Cytoscape to the standalone web UI bundle.
 */
export function KnowledgeGraphPanel(props: KnowledgeGraphPanelProps): React.ReactElement {
  const { graph, onTopicClick, onArtifactClick, className, focusArtifactId, focusArtifactTitle } =
    props;

  const [positionOverrides, setPositionOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [dragState, setDragState] = useState<{
    nodeId: string;
    startClientX: number;
    startClientY: number;
    startNodeX: number;
    startNodeY: number;
  } | null>(null);

  useEffect(() => {
    setPositionOverrides({});
  }, [graph.generatedAt, focusArtifactId]);

  useEffect(() => {
    if (dragState === null) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const nextX = clamp(dragState.startNodeX + event.clientX - dragState.startClientX, 48, 672);
      const nextY = clamp(dragState.startNodeY + event.clientY - dragState.startClientY, 48, 472);

      setPositionOverrides((current) => ({
        ...current,
        [dragState.nodeId]: {
          x: nextX,
          y: nextY,
        },
      }));
    };
    const handlePointerUp = () => {
      setDragState(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState]);

  const filteredEdges = useMemo(() => filterEdges(graph.edges, props), [graph.edges, props]);
  const focusNode = focusArtifactId
    ? graph.nodes.find(
        (node) =>
          node.type === 'knowledge-artifact' && node.properties.artifactId === focusArtifactId,
      )
    : null;
  const focusNodeIds = focusNode
    ? getFocusedKnowledgeGraphNodeIds(graph.nodes, filteredEdges, focusNode.id)
    : new Set<string>();

  const visibleNodes = focusNode
    ? graph.nodes.filter((node) => focusNodeIds.has(node.id))
    : graph.nodes;
  const visibleEdges = focusNode
    ? filteredEdges.filter((edge) => focusNodeIds.has(edge.source) && focusNodeIds.has(edge.target))
    : filteredEdges;

  const isFocused = Boolean(focusNode);
  const positionedNodes = positionGraphNodes(
    visibleNodes,
    visibleEdges,
    focusNode?.id ?? null,
    positionOverrides,
  );
  const positionedNodeById = new Map(positionedNodes.map((node) => [node.id, node]));
  const selectedNode = focusNode
    ? positionedNodeById.get(focusNode.id) ?? null
    : positionedNodes[0] ?? null;

  const handleNodeClick = (node: KnowledgeGraphNode) => {
    if (node.type === 'topic' && onTopicClick) {
      onTopicClick(node.topicKey, node);
    } else if (node.type === 'knowledge-artifact' && onArtifactClick) {
      const artifactId = node.properties.artifactId;
      if (artifactId) {
        onArtifactClick(artifactId, node);
      }
    }
  };

  return (
    <div className={className ?? 'knowledge-graph-panel'}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48">
            Knowledge Graph
          </p>
          <h3 className="mt-1 font-heading text-xl font-bold text-ink">
            {isFocused ? 'Focused Knowledge Graph' : 'Global Knowledge Graph'}
          </h3>
          <p className="mt-1 font-body text-sm text-inkMuted-80">
            {isFocused
              ? `Centered on ${focusArtifactTitle ?? focusNode?.label ?? focusArtifactId}`
              : 'All approved knowledge artifacts and their relations.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-inkMuted-80">
          <GraphStat label="Topics" value={graph.stats.topics} />
          <GraphStat label="Artifacts" value={graph.stats.knowledgeArtifacts} />
          <GraphStat
            label="References"
            value={visibleEdges.filter((edge) => edge.type === 'REFERENCES').length}
          />
          {props.showSimilarityEdges !== false && (
            <GraphStat
              label="Similar"
              value={visibleEdges.filter((edge) => edge.type === 'SIMILAR').length}
            />
          )}
        </div>
      </div>

      <div className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border border-hairline bg-slate-50">
        <div className="relative min-h-[420px] overflow-hidden bg-[radial-gradient(circle_at_30%_20%,rgba(0,102,204,0.13),transparent_32%),radial-gradient(circle_at_70%_80%,rgba(17,24,39,0.08),transparent_34%)]">
          {positionedNodes.length === 0 ? (
            <div className="flex h-full min-h-[420px] items-center justify-center p-8 text-center">
              <p className="font-body text-sm text-inkMuted-48">
                No knowledge graph nodes are available yet.
              </p>
            </div>
          ) : (
            <svg
              data-testid="knowledge-graph-canvas"
              role="img"
              aria-label={isFocused ? 'Focused knowledge graph canvas' : 'Global knowledge graph canvas'}
              viewBox="0 0 720 520"
              className="h-full min-h-[420px] w-full"
            >
              <defs>
                <filter id="knowledge-node-glow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="7" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              {visibleEdges.map((edge) => {
                const source = positionedNodeById.get(edge.source);
                const target = positionedNodeById.get(edge.target);
                if (!source || !target) {
                  return null;
                }

                const midX = (source.x + target.x) / 2;
                const midY = (source.y + target.y) / 2;

                return (
                  <g key={edge.id} data-testid="knowledge-graph-edge">
                    <line
                      x1={source.x}
                      y1={source.y}
                      x2={target.x}
                      y2={target.y}
                      stroke={getEdgeColor(edge.type)}
                      strokeWidth={edge.type === 'SIMILAR' ? 2.5 : 1.7}
                      strokeDasharray={edge.type === 'REFERENCES' ? '8 7' : undefined}
                      opacity="0.72"
                    />
                    <text
                      x={midX}
                      y={midY - 8}
                      textAnchor="middle"
                      className="fill-inkMuted-80 font-heading text-[10px] font-semibold"
                    >
                      {edge.type}
                    </text>
                  </g>
                );
              })}
              {positionedNodes.map((node) => (
                <g
                  key={node.id}
                  data-testid="knowledge-graph-node"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNodeClick(node)}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setDragState({
                      nodeId: node.id,
                      startClientX: event.clientX,
                      startClientY: event.clientY,
                      startNodeX: node.x,
                      startNodeY: node.y,
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handleNodeClick(node);
                    }
                  }}
                  className="cursor-pointer"
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.size + 9}
                    fill={node.color}
                    opacity={node.id === focusNode?.id ? '0.18' : '0.08'}
                  />
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.size}
                    fill={node.color}
                    fillOpacity={node.id === focusNode?.id ? '0.62' : '0.38'}
                    stroke={node.id === focusNode?.id ? '#38bdf8' : node.color}
                    strokeWidth={node.id === focusNode?.id ? 3 : 1.8}
                    filter={node.id === focusNode?.id ? 'url(#knowledge-node-glow)' : undefined}
                  />
                  <text
                    x={node.x}
                    y={node.y + node.size + 18}
                    textAnchor="middle"
                    className="fill-ink font-body text-[12px] font-semibold"
                  >
                    {truncateLabel(node.label, 22)}
                  </text>
                </g>
              ))}
            </svg>
          )}
        </div>

        <aside className="border-t border-hairline bg-canvas p-4">
          <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48">
            Selection
          </p>
          {selectedNode ? (
            <div className="mt-3 space-y-4">
              <div>
                <h4 className="font-heading text-lg font-semibold text-ink">{selectedNode.label}</h4>
                <p className="mt-1 font-body text-sm text-inkMuted-80">
                  {selectedNode.properties.title ?? selectedNode.topicKey}
                </p>
              </div>
              <div>
                <p className="font-heading text-xs font-semibold uppercase text-inkMuted-48">
                  Legend
                </p>
                <div className="mt-2 flex flex-col gap-2">
                  <GraphLegend color="#0066cc" label="Topic" />
                  <GraphLegend color="#111827" label="Knowledge artifact" />
                  <GraphLegend color="#38bdf8" label="Focused artifact" />
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-3 font-body text-sm text-inkMuted-48">
              Select a node to inspect its indexed context.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

function GraphStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-pill border border-hairline bg-canvas px-3 py-1 font-heading text-[11px] font-semibold uppercase">
      {label}: {value}
    </span>
  );
}

function GraphLegend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 font-body text-sm text-inkMuted-80">
      <span
        className="h-3 w-3 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </div>
  );
}

function positionGraphNodes(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  focusNodeId: string | null,
  positionOverrides: Record<string, { x: number; y: number }> = {},
): PositionedNode[] {
  const center = { x: 360, y: 245 };
  const relationships = edges.map((edge) => ({ source: edge.source, target: edge.target }));
  const sortedNodes = [...nodes].sort((left, right) => {
    if (left.id === focusNodeId) return -1;
    if (right.id === focusNodeId) return 1;
    return left.label.localeCompare(right.label);
  });
  const orbitNodes = focusNodeId
    ? sortedNodes.filter((node) => node.id !== focusNodeId)
    : sortedNodes;
  const radius = focusNodeId ? 175 : 180;

  return sortedNodes.map((node, index) => {
    if (node.id === focusNodeId) {
      const override = positionOverrides[node.id];
      return toPositionedNode(
        node,
        override?.x ?? center.x,
        override?.y ?? center.y,
        relationships,
        true,
      );
    }

    const orbitIndex = focusNodeId
      ? orbitNodes.findIndex((candidate) => candidate.id === node.id)
      : index;
    const angle = (Math.PI * 2 * orbitIndex) / Math.max(orbitNodes.length, 1) - Math.PI / 2;
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * (focusNodeId ? 125 : 155);
    const override = positionOverrides[node.id];
    return toPositionedNode(node, override?.x ?? x, override?.y ?? y, relationships, false);
  });
}

function getFocusedKnowledgeGraphNodeIds(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  focusNodeId: string,
): Set<string> {
  const nodeIds = new Set<string>([focusNodeId]);
  const topicIds = new Set<string>();

  for (const edge of edges) {
    if (edge.source === focusNodeId) {
      nodeIds.add(edge.target);
    }

    if (edge.target === focusNodeId) {
      nodeIds.add(edge.source);
    }

    if (edge.type !== 'CONTAINS') {
      continue;
    }

    if (edge.source === focusNodeId) {
      nodeIds.add(edge.target);
      topicIds.add(edge.target);
    }

    if (edge.target === focusNodeId) {
      nodeIds.add(edge.source);
      topicIds.add(edge.source);
    }
  }

  for (const node of nodes) {
    if (node.id === focusNodeId && node.topicKey.length > 0) {
      topicIds.add(`topic:${node.topicKey}`);
    }
  }

  for (const edge of edges) {
    if (edge.type === 'CONTAINS') {
      continue;
    }

    if (topicIds.has(edge.source)) {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
      topicIds.add(edge.target);
    }

    if (topicIds.has(edge.target)) {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
      topicIds.add(edge.source);
    }
  }

  for (const edge of edges) {
    if (edge.type !== 'CONTAINS') {
      continue;
    }

    if (topicIds.has(edge.source)) {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }

    if (topicIds.has(edge.target)) {
      nodeIds.add(edge.source);
      nodeIds.add(edge.target);
    }
  }

  return nodeIds;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toPositionedNode(
  node: KnowledgeGraphNode,
  x: number,
  y: number,
  relationships: Array<{ source: string; target: string }>,
  focused: boolean,
): PositionedNode {
  const degree = relationships.filter(
    (relationship) => relationship.source === node.id || relationship.target === node.id,
  ).length;
  return {
    ...node,
    x,
    y,
    size: Math.min((node.type === 'topic' ? 26 : 31) + degree * 3 + (focused ? 5 : 0), 46),
    color: node.type === 'topic' ? '#0066cc' : '#111827',
  };
}

function getEdgeColor(edgeType: KnowledgeGraphEdge['type']): string {
  if (edgeType === 'SIMILAR') {
    return '#38bdf8';
  }

  if (edgeType === 'REFERENCES') {
    return '#94a3b8';
  }

  return '#f59e0b';
}

function truncateLabel(label: string, maxLength: number): string {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

export default KnowledgeGraphPanel;
