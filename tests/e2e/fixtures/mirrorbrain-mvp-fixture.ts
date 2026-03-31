import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { startMirrorBrainHttpServer } from '../../../src/apps/mirrorbrain-http-server/index.js';
import { getMirrorBrainConfig } from '../../../src/shared/config/index.js';
import { prepareMirrorBrainWebAssets } from '../../../scripts/start-mirrorbrain-dev.js';

export async function startMirrorBrainMvpFixture() {
  const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-e2e-workspace-'));
  const staticDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-e2e-web-'));
  const memoryEvents = [
    {
      id: 'browser:aw-event-1',
      sourceType: 'activitywatch-browser',
      sourceRef: 'aw-event-1',
      timestamp: '2026-03-20T08:00:00.000Z',
      authorizationScopeId: 'scope-browser',
      content: {
        title: 'Example Tasks',
      },
      captureMetadata: {
        upstreamSource: 'activitywatch',
        checkpoint: '2026-03-20T08:00:00.000Z',
      },
    },
  ];
  let candidateMemory: {
    id: string;
    memoryEventIds: string[];
    reviewState: 'pending';
  } | null = null;
  let reviewedMemory: {
    id: string;
    candidateMemoryId: string;
    decision: 'keep';
  } | null = null;
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
      createCandidateMemory: async (events) => {
        candidateMemory = {
          id: `candidate:${events[0]?.id ?? 'empty'}`,
          memoryEventIds: events.map((event) => event.id),
          reviewState: 'pending',
        };

        return candidateMemory;
      },
      reviewCandidateMemory: async (candidate, review) => {
        reviewedMemory = {
          id: `reviewed:${candidate.id}`,
          candidateMemoryId: candidate.id,
          decision: review.decision as 'keep',
        };

        return reviewedMemory;
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
