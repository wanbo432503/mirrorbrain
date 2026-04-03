import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { startMirrorBrainHttpServer } from '../../../src/apps/mirrorbrain-http-server/index.js';
import { getMirrorBrainConfig } from '../../../src/shared/config/index.js';
import type {
  CandidateMemory,
  ReviewedMemory,
} from '../../../src/shared/types/index.js';
import { prepareMirrorBrainWebAssets } from '../../../scripts/start-mirrorbrain-dev.js';

export async function startMirrorBrainMvpFixture() {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-e2e-workspace-'));
  const staticDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-e2e-web-'));
  const reviewWindowDate = getPreviousCalendarDate(new Date());
  const memoryEvents = [
    {
      id: 'browser:aw-event-1',
      sourceType: 'activitywatch-browser',
      sourceRef: 'aw-event-1',
      timestamp: `${reviewWindowDate}T08:00:00.000Z`,
      authorizationScopeId: 'scope-browser',
      content: {
        title: 'Example Tasks',
      },
      captureMetadata: {
        upstreamSource: 'activitywatch',
        checkpoint: `${reviewWindowDate}T08:00:00.000Z`,
      },
    },
  ];
  let candidateMemory: CandidateMemory | null = null;
  let reviewedMemory: ReviewedMemory | null = null;
  let knowledgeArtifact: {
    id: string;
    artifactType: 'daily-review-draft';
    draftState: 'draft';
    topicKey: null;
    title: string;
    summary: string;
    body: string;
    sourceReviewedMemoryIds: string[];
    derivedFromKnowledgeIds: string[];
    version: number;
    isCurrentBest: false;
    supersedesKnowledgeId: null;
    updatedAt: string;
    reviewedAt: string;
    recencyLabel: string;
    provenanceRefs: Array<{
      kind: 'reviewed-memory';
      id: string;
    }>;
  } | null = null;
  let skillArtifact: {
    id: string;
    approvalState: 'draft';
    workflowEvidenceRefs: string[];
    executionSafetyMetadata: {
      requiresConfirmation: true;
    };
  } | null = null;

  await prepareMirrorBrainWebAssets({
    projectDir: process.cwd(),
    outputDir: staticDir,
  });

  const server = await startMirrorBrainHttpServer({
    port: 0,
    staticDir,
    service: {
      service: {
        status: 'running',
        config: getMirrorBrainConfig(),
      },
      syncBrowserMemory: async () => ({
        sourceKey: 'activitywatch-browser:aw-watcher-web-chrome',
        strategy: 'incremental' as const,
        importedCount: 1,
        lastSyncedAt: '2026-03-20T09:00:00.000Z',
      }),
      syncShellMemory: async () => ({
        sourceKey: 'shell-history:/tmp/.zsh_history',
        strategy: 'incremental' as const,
        importedCount: 0,
        lastSyncedAt: '2026-03-20T09:05:00.000Z',
      }),
      listMemoryEvents: async () => memoryEvents,
      queryMemory: async () => ({ items: [] }),
      listKnowledge: async () => (knowledgeArtifact === null ? [] : [knowledgeArtifact]),
      listSkillDrafts: async () => (skillArtifact === null ? [] : [skillArtifact]),
      createDailyCandidateMemories: async (_reviewDate: string) => {
        candidateMemory = {
          id: `candidate:${memoryEvents[0]?.id ?? 'empty'}`,
          memoryEventIds: memoryEvents.map((event) => event.id),
          title: 'Fixture Candidate',
          summary: `Fixture candidate for ${memoryEvents.length} events.`,
          theme: 'fixture / browser',
          reviewDate: reviewWindowDate,
          timeRange: {
            startAt:
              memoryEvents[0]?.timestamp ?? `${reviewWindowDate}T08:00:00.000Z`,
            endAt:
              memoryEvents[memoryEvents.length - 1]?.timestamp ??
              `${reviewWindowDate}T08:00:00.000Z`,
          },
          reviewState: 'pending',
        };

        return candidateMemory === null ? [] : [candidateMemory];
      },
      suggestCandidateReviews: async (candidates: CandidateMemory[]) =>
        candidates.map((candidate) => ({
          candidateMemoryId: candidate.id,
          recommendation: 'review' as const,
          confidenceScore: 0.55,
          priorityScore: candidate.memoryEventIds.length,
          rationale:
            'This daily stream has limited evidence and should stay in human review.',
        })),
      reviewCandidateMemory: async (candidate, review) => {
        reviewedMemory = {
          id: `reviewed:${candidate.id}`,
          candidateMemoryId: candidate.id,
          candidateTitle: candidate.title,
          candidateSummary: candidate.summary,
          candidateTheme: candidate.theme,
          memoryEventIds: candidate.memoryEventIds,
          reviewDate: candidate.reviewDate,
          decision: review.decision,
          reviewedAt: review.reviewedAt,
        };

        return reviewedMemory as ReviewedMemory;
      },
      generateKnowledgeFromReviewedMemories: async (reviewedMemories) => {
        knowledgeArtifact = {
          id: `knowledge-draft:${reviewedMemories[0]?.id ?? 'empty'}`,
          artifactType: 'daily-review-draft',
          draftState: 'draft',
          topicKey: null,
          title: reviewedMemories[0]?.candidateTitle ?? 'Daily Review Draft',
          summary: `Daily review draft for ${reviewedMemories[0]?.candidateTitle ?? 'reviewed memory'}.`,
          body: `- ${reviewedMemories[0]?.candidateTitle ?? 'Reviewed memory'}

${reviewedMemories.length} reviewed memory item${reviewedMemories.length === 1 ? '' : 's'} included.`,
          sourceReviewedMemoryIds: reviewedMemories.map((memory) => memory.id),
          derivedFromKnowledgeIds: [],
          version: 1,
          isCurrentBest: false,
          supersedesKnowledgeId: null,
          updatedAt: reviewedMemories[0]?.reviewedAt ?? `${reviewWindowDate}T10:00:00.000Z`,
          reviewedAt: reviewedMemories[0]?.reviewedAt ?? `${reviewWindowDate}T10:00:00.000Z`,
          recencyLabel: `reviewed on ${reviewedMemories[0]?.reviewDate ?? reviewWindowDate}`,
          provenanceRefs: reviewedMemories.map((memory) => ({
            kind: 'reviewed-memory' as const,
            id: memory.id,
          })),
        };

        return knowledgeArtifact;
      },
      generateSkillDraftFromReviewedMemories: async (reviewedMemories) => {
        skillArtifact = {
          id: `skill-draft:${reviewedMemories[0]?.id ?? 'empty'}`,
          approvalState: 'draft',
          workflowEvidenceRefs: reviewedMemories.map((memory) => memory.id),
          executionSafetyMetadata: {
            requiresConfirmation: true,
          },
        };

        return skillArtifact;
      },
    },
  });

  return {
    origin: server.origin,
    stop: server.stop,
    workspaceDir,
  };
}

function getPreviousCalendarDate(reference: Date): string {
  const previousDay = new Date(reference);
  previousDay.setDate(previousDay.getDate() - 1);
  return [
    previousDay.getFullYear(),
    String(previousDay.getMonth() + 1).padStart(2, '0'),
    String(previousDay.getDate()).padStart(2, '0'),
  ].join('-');
}
