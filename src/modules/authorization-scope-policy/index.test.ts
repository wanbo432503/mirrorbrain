import { describe, expect, it } from 'vitest';

import {
  createAuthorizationScope,
  isSourceCategoryAuthorized,
  revokeAuthorizationScope,
} from './index.js';

describe('authorization scope policy', () => {
  it('allows explicitly authorized source categories', () => {
    const scope = createAuthorizationScope({
      id: 'scope-browser',
      sourceCategory: 'browser',
    });

    expect(isSourceCategoryAuthorized(scope, 'browser')).toBe(true);
    expect(isSourceCategoryAuthorized(scope, 'shell')).toBe(false);
  });

  it('supports shell and openclaw-conversation source categories', () => {
    const shellScope = createAuthorizationScope({
      id: 'scope-shell',
      sourceCategory: 'shell',
    });
    const conversationScope = createAuthorizationScope({
      id: 'scope-conversation',
      sourceCategory: 'openclaw-conversation',
    });

    expect(isSourceCategoryAuthorized(shellScope, 'shell')).toBe(true);
    expect(
      isSourceCategoryAuthorized(
        conversationScope,
        'openclaw-conversation',
      ),
    ).toBe(true);
  });

  it('disables future ingestion after revocation', () => {
    const scope = createAuthorizationScope({
      id: 'scope-browser',
      sourceCategory: 'browser',
    });

    const revokedScope = revokeAuthorizationScope(scope);

    expect(isSourceCategoryAuthorized(revokedScope, 'browser')).toBe(false);
  });
});
