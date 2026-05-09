import {
  isBlacklistedTag,
  isGenericTag,
  extractTags,
} from './tag-extraction.js';

import {
  identifyPrimaryTopic,
  identifySupportingThemes,
  extractPatternsFromMemories,
  runDiscoveryStage,
  type DiscoveryResult,
} from './discovery-stage.js';

import {
  formatWikiLink,
  generateKnowledgeTitle,
  generateKnowledgeSummary,
  generateKnowledgeBody,
  runExecuteStage,
  type ExecuteResult,
} from './execute-stage.js';

export {
  // Tag extraction
  isBlacklistedTag,
  isGenericTag,
  extractTags,

  // Discovery stage
  identifyPrimaryTopic,
  identifySupportingThemes,
  extractPatternsFromMemories,
  runDiscoveryStage,

  // Execute stage
  formatWikiLink,
  generateKnowledgeTitle,
  generateKnowledgeSummary,
  generateKnowledgeBody,
  runExecuteStage,

  // Types
  type DiscoveryResult,
  type ExecuteResult,
};