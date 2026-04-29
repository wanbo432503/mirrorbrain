import { existsSync, mkdirSync } from 'node:fs';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { startMirrorBrainHttpServer } from '../../src/apps/mirrorbrain-http-server/index.js';
import { getMirrorBrainConfig } from '../../src/shared/config/index.js';
import type {
  CandidateMemory,
  KnowledgeArtifact,
  MemoryEvent,
  ReviewedMemory,
} from '../../src/shared/types/index.js';

describe('review to artifacts integration', () => {
  it('should remove candidates from list after approve', async () => {
    // Setup: Create workspace directory
    const workspaceDir = mkdtempSync(join(tmpdir(), 'mirrorbrain-review-test-'));
    const reviewDate = '2026-04-29';

    // Create candidate memory files in workspace
    const candidate1: CandidateMemory = {
      id: `candidate:${reviewDate}:activitywatch-browser:test1`,
      memoryEventIds: ['browser:event1'],
      title: 'Test Candidate 1',
      summary: 'Test candidate 1 summary',
      theme: 'test1',
      formationReasons: ['Test reason'],
      compressedSourceCount: 0,
      reviewDate,
      timeRange: {
        startAt: `${reviewDate}T08:00:00.000Z`,
        endAt: `${reviewDate}T08:00:00.000Z`,
      },
      sourceRefs: [
        {
          id: 'browser:event1',
          contribution: 'primary',
          sourceType: 'activitywatch-browser',
          timestamp: `${reviewDate}T08:00:00.000Z`,
          title: 'Test Event 1',
          url: 'https://example.com/test1',
          role: 'web',
        },
      ],
      reviewState: 'pending',
    };

    const candidate2: CandidateMemory = {
      id: `candidate:${reviewDate}:activitywatch-browser:test2`,
      memoryEventIds: ['browser:event2'],
      title: 'Test Candidate 2',
      summary: 'Test candidate 2 summary',
      theme: 'test2',
      formationReasons: ['Test reason'],
      compressedSourceCount: 0,
      reviewDate,
      timeRange: {
        startAt: `${reviewDate}T09:00:00.000Z`,
        endAt: `${reviewDate}T09:00:00.000Z`,
      },
      sourceRefs: [
        {
          id: 'browser:event2',
          contribution: 'primary',
          sourceType: 'activitywatch-browser',
          timestamp: `${reviewDate}T09:00:00.000Z`,
          title: 'Test Event 2',
          url: 'https://example.com/test2',
          role: 'web',
        },
      ],
      reviewState: 'pending',
    };

    const candidate3: CandidateMemory = {
      id: `candidate:${reviewDate}:activitywatch-browser:test3`,
      memoryEventIds: ['browser:event3'],
      title: 'Test Candidate 3',
      summary: 'Test candidate 3 summary',
      theme: 'test3',
      formationReasons: ['Test reason'],
      compressedSourceCount: 0,
      reviewDate,
      timeRange: {
        startAt: `${reviewDate}T10:00:00.000Z`,
        endAt: `${reviewDate}T10:00:00.000Z`,
      },
      sourceRefs: [
        {
          id: 'browser:event3',
          contribution: 'primary',
          sourceType: 'activitywatch-browser',
          timestamp: `${reviewDate}T10:00:00.000Z`,
          title: 'Test Event 3',
          url: 'https://example.com/test3',
          role: 'web',
        },
      ],
      reviewState: 'pending',
    };

    // Create candidate files in workspace
    const candidatesDir = join(workspaceDir, 'mirrorbrain', 'candidate-memories');
    mkdirSync(candidatesDir, { recursive: true });
    writeFileSync(
      join(candidatesDir, `${candidate1.id}.json`),
      JSON.stringify(candidate1, null, 2),
    );
    writeFileSync(
      join(candidatesDir, `${candidate2.id}.json`),
      JSON.stringify(candidate2, null, 2),
    );
    writeFileSync(
      join(candidatesDir, `${candidate3.id}.json`),
      JSON.stringify(candidate3, null, 2),
    );

    // Setup reviewed memories that will be used for knowledge generation
    const reviewed1: ReviewedMemory = {
      id: `reviewed:${candidate1.id}`,
      candidateMemoryId: candidate1.id,
      candidateTitle: candidate1.title,
      candidateSummary: candidate1.summary,
      candidateTheme: candidate1.theme,
      candidateFormationReasons: candidate1.formationReasons,
      candidateTimeRange: candidate1.timeRange,
      memoryEventIds: candidate1.memoryEventIds,
      reviewDate,
      decision: 'keep',
      reviewedAt: `${reviewDate}T11:00:00.000Z`,
    };

    const reviewed2: ReviewedMemory = {
      id: `reviewed:${candidate2.id}`,
      candidateMemoryId: candidate2.id,
      candidateTitle: candidate2.title,
      candidateSummary: candidate2.summary,
      candidateTheme: candidate2.theme,
      candidateFormationReasons: candidate2.formationReasons,
      candidateTimeRange: candidate2.timeRange,
      memoryEventIds: candidate2.memoryEventIds,
      reviewDate,
      decision: 'keep',
      reviewedAt: `${reviewDate}T11:00:00.000Z`,
    };

    // Knowledge draft that references the two reviewed memories
    let knowledgeDraft: KnowledgeArtifact | null = {
      id: `knowledge-draft:${reviewed1.id}`,
      artifactType: 'daily-review-draft',
      draftState: 'draft',
      topicKey: null,
      title: 'Test Knowledge',
      summary: 'Knowledge from test candidates',
      body: 'Test knowledge body',
      sourceReviewedMemoryIds: [reviewed1.id, reviewed2.id],
      derivedFromKnowledgeIds: [],
      version: 1,
      isCurrentBest: false,
      supersedesKnowledgeId: null,
      updatedAt: `${reviewDate}T11:00:00.000Z`,
      reviewedAt: `${reviewDate}T11:00:00.000Z`,
      recencyLabel: `reviewed on ${reviewDate}`,
      provenanceRefs: [
        { kind: 'reviewed-memory', id: reviewed1.id },
        { kind: 'reviewed-memory', id: reviewed2.id },
      ],
    };

    // Start HTTP server with service
    const server = await startMirrorBrainHttpServer({
      port: 0,
      workspaceDir,
      service: {
        service: {
          status: 'running',
          config: getMirrorBrainConfig(),
        },
        syncBrowserMemory: async () => ({
          sourceKey: 'activitywatch-browser:test',
          strategy: 'incremental' as const,
          importedCount: 0,
          lastSyncedAt: `${reviewDate}T00:00:00.000Z`,
        }),
        syncShellMemory: async () => ({
          sourceKey: 'shell-history:test',
          strategy: 'incremental' as const,
          importedCount: 0,
          lastSyncedAt: `${reviewDate}T00:00:00.000Z`,
        }),
        listCandidateMemoriesByDate: async (date: string) => {
          if (date !== reviewDate) return [];
          // Load candidate files from workspace
          const files = [
            join(candidatesDir, `${candidate1.id}.json`),
            join(candidatesDir, `${candidate2.id}.json`),
            join(candidatesDir, `${candidate3.id}.json`),
          ];
          const candidates: CandidateMemory[] = [];
          for (const file of files) {
            if (existsSync(file)) {
              const content = readFileSync(file, 'utf8');
              candidates.push(JSON.parse(content) as CandidateMemory);
            }
          }
          return candidates;
        },
        createDailyCandidateMemories: async () => [],
        suggestCandidateReviews: async () => [],
        reviewCandidateMemory: async (candidate, review) => {
          return {
            id: `reviewed:${candidate.id}`,
            candidateMemoryId: candidate.id,
            candidateTitle: candidate.title,
            candidateSummary: candidate.summary,
            candidateTheme: candidate.theme,
            candidateFormationReasons: candidate.formationReasons,
            candidateTimeRange: candidate.timeRange,
            memoryEventIds: candidate.memoryEventIds,
            reviewDate: candidate.reviewDate,
            decision: review.decision,
            reviewedAt: review.reviewedAt,
          } as ReviewedMemory;
        },
        undoCandidateReview: async () => undefined,
        generateKnowledgeFromReviewedMemories: async (reviewedMemories) => {
          knowledgeDraft = {
            id: `knowledge-draft:${reviewedMemories[0]?.id ?? 'empty'}`,
            artifactType: 'daily-review-draft',
            draftState: 'draft',
            topicKey: null,
            title: reviewedMemories[0]?.candidateTitle ?? 'Test Knowledge',
            summary: `Knowledge from ${reviewedMemories.length} reviewed memories`,
            body: `Test knowledge body with ${reviewedMemories.length} items`,
            sourceReviewedMemoryIds: reviewedMemories.map((r) => r.id),
            derivedFromKnowledgeIds: [],
            version: 1,
            isCurrentBest: false,
            supersedesKnowledgeId: null,
            updatedAt: reviewedMemories[0]?.reviewedAt ?? `${reviewDate}T12:00:00.000Z`,
            reviewedAt: reviewedMemories[0]?.reviewedAt ?? `${reviewDate}T12:00:00.000Z`,
            recencyLabel: `reviewed on ${reviewDate}`,
            provenanceRefs: reviewedMemories.map((r) => ({
              kind: 'reviewed-memory' as const,
              id: r.id,
            })),
          };
          return knowledgeDraft;
        },
        approveKnowledgeDraft: async (draftId) => {
          if (!knowledgeDraft || knowledgeDraft.id !== draftId) {
            throw new Error(`Knowledge draft not found: ${draftId}`);
          }
          // Publish the knowledge (mark as approved)
          const publishedArtifact: KnowledgeArtifact = {
            ...knowledgeDraft,
            draftState: 'published',
          };
          return {
            publishedArtifact,
            assignedTopic: {
              topicKey: 'test-topic',
              title: knowledgeDraft.title ?? 'Untitled Knowledge',
            },
          };
        },
        listKnowledge: async () => {
          return knowledgeDraft ? [knowledgeDraft] : [];
        },
        deleteCandidateMemory: async (candidateMemoryId: string) => {
          const filePath = join(candidatesDir, `${candidateMemoryId}.json`);

          // Validate ID format
          if (!candidateMemoryId.startsWith('candidate:')) {
            throw new Error('Invalid candidate memory ID format');
          }
          if (candidateMemoryId.includes('..') || candidateMemoryId.includes('/') || candidateMemoryId.includes('\\')) {
            throw new Error('Invalid candidate memory ID format: path traversal detected');
          }

          // Delete file (idempotent - ENOENT is OK)
          try {
            const { unlink } = await import('node:fs/promises');
            await unlink(filePath);
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
              // File already deleted - this is OK (idempotent)
              return;
            }
            throw error;
          }
        },
        listMemoryEvents: async () => [],
        queryMemory: async () => ({ items: [] }),
        listSkillDrafts: async () => [],
        generateSkillDraftFromReviewedMemories: async () => ({
          id: 'skill-draft:test',
          approvalState: 'draft' as const,
          workflowEvidenceRefs: [],
          executionSafetyMetadata: {
            requiresConfirmation: true,
          },
        }),
      },
    });

    try {
      // Create API client helper
      const api = {
        async listCandidateMemoriesByDate(date: string) {
          const response = await fetch(`${server.origin}/candidate-memories?reviewDate=${date}`);
          if (!response.ok) {
            throw new Error(`Failed to list candidates: ${response.statusText}`);
          }
          const data = await response.json();
          return (data.candidates || []) as CandidateMemory[];
        },
        async reviewCandidateMemory(candidateId: string, decision: 'keep' | 'discard') {
          // First get the candidate object
          const candidates = await this.listCandidateMemoriesByDate(reviewDate);
          const candidate = candidates.find(c => c.id === candidateId);
          if (!candidate) {
            throw new Error(`Candidate not found: ${candidateId}`);
          }

          const response = await fetch(`${server.origin}/reviewed-memories`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              candidate,
              review: {
                decision,
                reviewedAt: `${reviewDate}T11:00:00.000Z`,
              },
            }),
          });
          if (!response.ok) {
            throw new Error(`Failed to review candidate: ${response.statusText}`);
          }
          const data = await response.json();
          return data.reviewedMemory as ReviewedMemory;
        },
        async generateKnowledge(reviewedMemories: ReviewedMemory[]) {
          const response = await fetch(`${server.origin}/knowledge/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reviewedMemories }),
          });
          if (!response.ok) {
            throw new Error(`Failed to generate knowledge: ${response.statusText}`);
          }
          const data = await response.json();
          return data.artifact as KnowledgeArtifact;
        },
        async approveKnowledge(draft: KnowledgeArtifact) {
          const response = await fetch(`${server.origin}/knowledge/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draftId: draft.id, draft }),
          });
          if (!response.ok) {
            throw new Error(`Failed to approve knowledge: ${response.statusText}`);
          }
          return (await response.json()) as {
            publishedArtifact: KnowledgeArtifact;
            assignedTopic: { topicKey: string; title: string };
          };
        },
        async deleteCandidateMemory(candidateId: string) {
          const response = await fetch(`${server.origin}/candidate-memories/${candidateId}`, {
            method: 'DELETE',
          });
          if (!response.ok && response.status !== 404) {
            throw new Error(`Failed to delete candidate: ${response.statusText}`);
          }
        },
      };

      // Step 1: Verify initial candidates exist
      const initialCandidates = await api.listCandidateMemoriesByDate(reviewDate);
      expect(initialCandidates.length).toBe(3);
      expect(initialCandidates.map((c) => c.id)).toEqual([
        candidate1.id,
        candidate2.id,
        candidate3.id,
      ]);

      // Verify files exist in workspace
      expect(existsSync(join(candidatesDir, `${candidate1.id}.json`))).toBe(true);
      expect(existsSync(join(candidatesDir, `${candidate2.id}.json`))).toBe(true);
      expect(existsSync(join(candidatesDir, `${candidate3.id}.json`))).toBe(true);

      // Step 2: Keep candidates (candidate1 and candidate2)
      const keptReviewed1 = await api.reviewCandidateMemory(candidate1.id, 'keep');
      const keptReviewed2 = await api.reviewCandidateMemory(candidate2.id, 'keep');
      expect(keptReviewed1.id).toBe(`reviewed:${candidate1.id}`);
      expect(keptReviewed2.id).toBe(`reviewed:${candidate2.id}`);

      // Step 3: Generate knowledge draft from kept candidates
      const generatedDraft = await api.generateKnowledge([keptReviewed1, keptReviewed2]);
      expect(generatedDraft.id).toBeDefined();
      expect(generatedDraft.sourceReviewedMemoryIds).toEqual([
        keptReviewed1.id,
        keptReviewed2.id,
      ]);

      // Step 4: Approve knowledge
      const approveResult = await api.approveKnowledge(generatedDraft);
      expect(approveResult.publishedArtifact).toBeDefined();
      expect(approveResult.publishedArtifact.draftState).toBe('published');
      expect(approveResult.assignedTopic).toBeDefined();

      // Step 5: Delete candidates referenced by approved knowledge
      // Extract candidate IDs from reviewed memory IDs
      const candidateIdsToDelete = generatedDraft.sourceReviewedMemoryIds.map((reviewedId) =>
        reviewedId.replace(/^reviewed:/, ''), // Remove 'reviewed:' prefix, keep the rest which already has 'candidate:'
      );

      for (const candidateId of candidateIdsToDelete) {
        await api.deleteCandidateMemory(candidateId);
      }

      // Step 6: Verify candidates removed from API list
      const remainingCandidates = await api.listCandidateMemoriesByDate(reviewDate);
      expect(remainingCandidates.length).toBe(1);
      expect(remainingCandidates[0]?.id).toBe(candidate3.id);

      // Verify deleted candidates are not in the list
      expect(remainingCandidates.find((c) => c.id === candidate1.id)).toBeUndefined();
      expect(remainingCandidates.find((c) => c.id === candidate2.id)).toBeUndefined();

      // Step 7: Verify candidate files deleted from workspace
      expect(existsSync(join(candidatesDir, `${candidate1.id}.json`))).toBe(false);
      expect(existsSync(join(candidatesDir, `${candidate2.id}.json`))).toBe(false);
      expect(existsSync(join(candidatesDir, `${candidate3.id}.json`))).toBe(true); // This one should still exist
    } finally {
      await server.stop();
    }
  });
});
