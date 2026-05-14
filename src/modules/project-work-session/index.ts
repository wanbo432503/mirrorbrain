import type {
  MemoryTimeRange,
} from '../../shared/types/index.js';
import type { WorkSessionCandidate } from '../../workflows/work-session-analysis/index.js';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'active' | 'paused' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface ReviewedWorkSession {
  id: string;
  candidateId: string;
  projectId: string | null;
  title: string;
  summary: string;
  memoryEventIds: string[];
  sourceTypes: string[];
  timeRange: MemoryTimeRange;
  relationHints: string[];
  reviewState: 'reviewed' | 'discarded';
  reviewedAt: string;
  reviewedBy: string;
}

export type ProjectAssignment =
  | {
      kind: 'existing-project';
      projectId: string;
    }
  | {
      kind: 'confirmed-new-project';
      name: string;
      description?: string;
    };

export interface ReviewWorkSessionCandidateInput {
  decision: 'keep' | 'discard';
  reviewedAt: string;
  reviewedBy: string;
  title?: string;
  summary?: string;
  projectAssignment?: ProjectAssignment;
}

export interface ReviewWorkSessionCandidateResult {
  reviewedWorkSession: ReviewedWorkSession;
  project?: Project;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/gu, '');

  return slug.length > 0 ? slug : 'untitled';
}

function createConfirmedProject(
  assignment: Extract<ProjectAssignment, { kind: 'confirmed-new-project' }>,
  reviewedAt: string,
): Project {
  return {
    id: `project:${slugify(assignment.name)}`,
    name: assignment.name,
    description: assignment.description,
    status: 'active',
    createdAt: reviewedAt,
    updatedAt: reviewedAt,
  };
}

function resolveProject(input: {
  decision: ReviewWorkSessionCandidateInput['decision'];
  projectAssignment?: ProjectAssignment;
  reviewedAt: string;
}): { projectId: string | null; project?: Project } {
  if (input.decision === 'discard') {
    return { projectId: null };
  }

  if (!input.projectAssignment) {
    throw new Error('Kept work sessions require an explicit project assignment.');
  }

  if (input.projectAssignment.kind === 'existing-project') {
    return { projectId: input.projectAssignment.projectId };
  }

  const project = createConfirmedProject(input.projectAssignment, input.reviewedAt);

  return {
    project,
    projectId: project.id,
  };
}

export function reviewWorkSessionCandidate(
  candidate: WorkSessionCandidate,
  input: ReviewWorkSessionCandidateInput,
): ReviewWorkSessionCandidateResult {
  const { projectId, project } = resolveProject({
    decision: input.decision,
    projectAssignment: input.projectAssignment,
    reviewedAt: input.reviewedAt,
  });

  return {
    project,
    reviewedWorkSession: {
      id: `reviewed-work-session:${candidate.id}`,
      candidateId: candidate.id,
      projectId,
      title: input.title ?? candidate.title,
      summary: input.summary ?? candidate.summary,
      memoryEventIds: [...candidate.memoryEventIds],
      sourceTypes: [...candidate.sourceTypes],
      timeRange: { ...candidate.timeRange },
      relationHints: [...candidate.relationHints],
      reviewState: input.decision === 'keep' ? 'reviewed' : 'discarded',
      reviewedAt: input.reviewedAt,
      reviewedBy: input.reviewedBy,
    },
  };
}
