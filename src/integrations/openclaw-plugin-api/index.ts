import type {
  KnowledgeArtifact,
  MemoryEvent,
  SkillArtifact,
} from '../../shared/types/index.js';
import {
  listMirrorBrainKnowledgeArtifactsFromOpenViking,
  listMirrorBrainMemoryEventsFromOpenViking,
  listMirrorBrainSkillArtifactsFromOpenViking,
} from '../openviking-store/index.js';

interface QueryMemoryInput {
  baseUrl: string;
}

interface ListKnowledgeInput {
  baseUrl: string;
}

interface ListSkillDraftsInput {
  baseUrl: string;
}

interface OpenClawPluginApiDependencies {
  listMemoryEvents?: (input: QueryMemoryInput) => Promise<MemoryEvent[]>;
  listKnowledgeArtifacts?: (
    input: ListKnowledgeInput,
  ) => Promise<KnowledgeArtifact[]>;
  listSkillArtifacts?: (input: ListSkillDraftsInput) => Promise<SkillArtifact[]>;
}

export async function queryMemory(
  input: QueryMemoryInput,
  dependencies: OpenClawPluginApiDependencies = {},
): Promise<MemoryEvent[]> {
  const listMemoryEvents =
    dependencies.listMemoryEvents ?? listMirrorBrainMemoryEventsFromOpenViking;

  return listMemoryEvents(input);
}

export async function listKnowledge(
  input: ListKnowledgeInput,
  dependencies: OpenClawPluginApiDependencies = {},
): Promise<KnowledgeArtifact[]> {
  const listKnowledgeArtifacts =
    dependencies.listKnowledgeArtifacts ??
    listMirrorBrainKnowledgeArtifactsFromOpenViking;

  return listKnowledgeArtifacts(input);
}

export async function listSkillDrafts(
  input: ListSkillDraftsInput,
  dependencies: OpenClawPluginApiDependencies = {},
): Promise<SkillArtifact[]> {
  const listSkillArtifacts =
    dependencies.listSkillArtifacts ?? listMirrorBrainSkillArtifactsFromOpenViking;

  return listSkillArtifacts(input);
}
