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
  const reviewDate = new Date().toISOString().slice(0, 10);
  const memoryEvents = [
    {
      id: 'browser:aw-event-1',
      sourceType: 'activitywatch-browser',
      sourceRef: 'aw-event-1',
      timestamp: `${reviewDate}T08:00:00.000Z`,
      authorizationScopeId: 'scope-browser',
      content: {
        title: 'Example Tasks',
      },
      captureMetadata: {
        upstreamSource: 'activitywatch',
        checkpoint: `${reviewDate}T08:00:00.000Z`,
      },
    },
  ];
  let candidateMemory: CandidateMemory | null = null;
  let reviewedMemory: ReviewedMemory | null = null;
  let knowledgeArtifact: {
    id: string;
    draftState: 'draft';
    sourceReviewedMemoryIds: string[];
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
      queryMemory: async () => memoryEvents,
      listKnowledge: async () => (knowledgeArtifact === null ? [] : [knowledgeArtifact]),
      listSkillDrafts: async () => (skillArtifact === null ? [] : [skillArtifact]),
      createDailyCandidateMemories: async (_reviewDate: string) => {
        candidateMemory = {
          id: `candidate:${memoryEvents[0]?.id ?? 'empty'}`,
          memoryEventIds: memoryEvents.map((event) => event.id),
          title: 'Fixture Candidate',
          summary: `Fixture candidate for ${memoryEvents.length} events.`,
          theme: 'fixture / browser',
          reviewDate,
          timeRange: {
            startAt: memoryEvents[0]?.timestamp ?? `${reviewDate}T08:00:00.000Z`,
            endAt:
              memoryEvents[memoryEvents.length - 1]?.timestamp ??
              `${reviewDate}T08:00:00.000Z`,
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
          draftState: 'draft',
          sourceReviewedMemoryIds: reviewedMemories.map((memory) => memory.id),
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
