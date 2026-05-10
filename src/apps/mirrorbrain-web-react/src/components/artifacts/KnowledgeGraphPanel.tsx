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
  const { graph, onTopicClick, onArtifactClick, className } = props;

  const filteredEdges = filterEdges(graph.edges, props);

  const topicNodes = graph.nodes.filter((n) => n.type === 'topic');
  const artifactNodes = graph.nodes.filter((n) => n.type === 'knowledge-artifact');

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
      {/* Stats Header */}
      <div className="graph-stats flex gap-4 text-sm text-slate-600 mb-4">
        <span className="px-2 py-1 bg-slate-100 rounded">
          Topics: {graph.stats.topics}
        </span>
        <span className="px-2 py-1 bg-slate-100 rounded">
          Artifacts: {graph.stats.knowledgeArtifacts}
        </span>
        <span className="px-2 py-1 bg-teal-100 rounded">
          References: {filteredEdges.filter((e) => e.type === 'REFERENCES').length}
        </span>
        {props.showSimilarityEdges !== false && (
          <span className="px-2 py-1 bg-blue-100 rounded">
            Similar: {filteredEdges.filter((e) => e.type === 'SIMILAR').length}
          </span>
        )}
      </div>

      {/* Placeholder for graph visualization */}
      <div
        className="graph-container border border-slate-200 rounded-lg bg-slate-50"
        style={{ minHeight: '400px', padding: '16px' }}
      >
        {/* Placeholder content - simple node list */}
        <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
          Topics (click to view)
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {topicNodes.map((node) => (
            <button
              key={node.id}
              onClick={() => handleNodeClick(node)}
              className="px-3 py-1 bg-teal-500 text-white rounded hover:bg-teal-600 transition-colors text-sm"
            >
              {node.label}
            </button>
          ))}
        </div>

        <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">
          Artifacts
        </div>
        <div className="flex flex-wrap gap-2">
          {artifactNodes.map((node) => (
            <button
              key={node.id}
              onClick={() => handleNodeClick(node)}
              className="px-3 py-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors text-sm"
            >
              {node.label}
            </button>
          ))}
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