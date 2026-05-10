/**
 * Knowledge Graph Panel
 *
 * Placeholder component for knowledge graph visualization.
 * This provides a clean interface for future Cytoscape.js or similar visualization integration.
 *
 * Usage:
 * - Fetch graph data using api.getKnowledgeGraph()
 * - Pass to this component for rendering
 * - Handle topic/artifact click events for navigation
 */

import type {
  KnowledgeGraphSnapshot,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
} from '../../types/index';

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
 * Placeholder component for knowledge graph visualization.
 *
 * Currently renders a simple stats display and node list.
 * To be replaced with Cytoscape.js or similar visualization library.
 */
export function KnowledgeGraphPanel(props: KnowledgeGraphPanelProps): React.ReactElement {
  const { graph, onTopicClick, onArtifactClick, className, focusArtifactId, focusArtifactTitle } =
    props;

  const filteredEdges = filterEdges(graph.edges, props);
  const focusNode = focusArtifactId
    ? graph.nodes.find(
        (node) =>
          node.type === 'knowledge-artifact' && node.properties.artifactId === focusArtifactId,
      )
    : null;
  const focusNodeIds = new Set<string>();

  if (focusNode) {
    focusNodeIds.add(focusNode.id);
    filteredEdges.forEach((edge) => {
      if (edge.source === focusNode.id) {
        focusNodeIds.add(edge.target);
      }
      if (edge.target === focusNode.id) {
        focusNodeIds.add(edge.source);
      }
    });
  }

  const visibleNodes = focusNode
    ? graph.nodes.filter((node) => focusNodeIds.has(node.id))
    : graph.nodes;
  const visibleEdges = focusNode
    ? filteredEdges.filter((edge) => focusNodeIds.has(edge.source) && focusNodeIds.has(edge.target))
    : filteredEdges;

  const topicNodes = visibleNodes.filter((n) => n.type === 'topic');
  const artifactNodes = visibleNodes.filter((n) => n.type === 'knowledge-artifact');
  const isFocused = Boolean(focusNode);

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
      <div className="mb-4">
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

      {/* Stats Header */}
      <div className="graph-stats flex gap-4 text-sm text-inkMuted-80 mb-4">
        <span className="px-2 py-1 bg-slate-100 rounded">
          Topics: {graph.stats.topics}
        </span>
        <span className="px-2 py-1 bg-slate-100 rounded">
          Artifacts: {graph.stats.knowledgeArtifacts}
        </span>
        <span className="px-2 py-1 bg-dividerSoft rounded">
          References: {visibleEdges.filter((e) => e.type === 'REFERENCES').length}
        </span>
        {props.showSimilarityEdges !== false && (
          <span className="px-2 py-1 bg-blue-100 rounded">
            Similar: {visibleEdges.filter((e) => e.type === 'SIMILAR').length}
          </span>
        )}
      </div>

      {/* Placeholder for graph visualization */}
      <div
        className="graph-container border border-hairline rounded-lg bg-slate-50"
        style={{ minHeight: '400px', padding: '16px' }}
      >
        {/* Placeholder content - simple node list */}
        <div className="text-xs uppercase tracking-wide text-inkMuted-48 mb-2">
          Topics (click to view)
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {topicNodes.length === 0 ? (
            <p className="font-body text-sm text-inkMuted-48">No topic nodes in this view.</p>
          ) : (
            topicNodes.map((node) => (
              <button
                key={node.id}
                onClick={() => handleNodeClick(node)}
                className="px-3 py-1 bg-primary text-white rounded hover:bg-primary transition-colors text-sm"
              >
                {node.label}
              </button>
            ))
          )}
        </div>

        <div className="text-xs uppercase tracking-wide text-inkMuted-48 mb-2">
          Artifacts
        </div>
        <div className="flex flex-wrap gap-2">
          {artifactNodes.length === 0 ? (
            <p className="font-body text-sm text-inkMuted-48">
              No knowledge artifact nodes in this view.
            </p>
          ) : (
            artifactNodes.map((node) => (
              <button
                key={node.id}
                onClick={() => handleNodeClick(node)}
                className={`px-3 py-1 rounded transition-colors text-sm ${
                  node.id === focusNode?.id
                    ? 'bg-primary text-white'
                    : 'bg-hairline text-slate-700 hover:bg-slate-300'
                }`}
              >
                {node.label}
              </button>
            ))
          )}
        </div>

        {/* Note about visualization */}
        <div className="mt-4 text-xs text-slate-400 italic">
          Graph visualization placeholder. Integrate Cytoscape.js for interactive network view.
        </div>
      </div>
    </div>
  );
}

export default KnowledgeGraphPanel;
