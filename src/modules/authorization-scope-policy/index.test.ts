import { describe, expect, it } from 'vitest';

import {
  createAuthorizationScope,
  createMemorySourceAuthorizationPolicy,
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

  it('supports shell and agent source categories', () => {
    const shellScope = createAuthorizationScope({
      id: 'scope-shell',
      sourceCategory: 'shell',
    });
    const agentScope = createAuthorizationScope({
      id: 'scope-agent',
      sourceCategory: 'agent',
    });

    expect(isSourceCategoryAuthorized(shellScope, 'shell')).toBe(true);
    expect(isSourceCategoryAuthorized(agentScope, 'agent')).toBe(true);
  });

  it('disables future ingestion after revocation', () => {
    const scope = createAuthorizationScope({
      id: 'scope-browser',
      sourceCategory: 'browser',
    });

    const revokedScope = revokeAuthorizationScope(scope);

    expect(isSourceCategoryAuthorized(revokedScope, 'browser')).toBe(false);
  });

  it('creates a runtime source sync policy from authorization scopes', async () => {
    const policy = createMemorySourceAuthorizationPolicy({
      getAuthorizationScope: async (scopeId) =>
        scopeId === 'scope-browser'
          ? createAuthorizationScope({
              id: 'scope-browser',
              sourceCategory: 'browser',
            })
          : null,
    });

    await expect(
      policy({
        scopeId: 'scope-browser',
        sourceKey: 'activitywatch-browser:chrome',
        sourceCategory: 'browser',
      }),
    ).resolves.toBe(true);
    await expect(
      policy({
        scopeId: 'scope-browser',
        sourceKey: 'shell-history:/tmp/.zsh_history',
        sourceCategory: 'shell',
      }),
    ).resolves.toBe(false);
    await expect(
      policy({
        scopeId: 'missing-scope',
        sourceKey: 'activitywatch-browser:chrome',
        sourceCategory: 'browser',
      }),
    ).resolves.toBe(false);
  });

  it('denies runtime source sync for revoked scopes', async () => {
    const revokedScope = revokeAuthorizationScope(
      createAuthorizationScope({
        id: 'scope-shell',
        sourceCategory: 'shell',
      }),
    );
    const policy = createMemorySourceAuthorizationPolicy({
      getAuthorizationScope: async () => revokedScope,
    });

    await expect(
      policy({
        scopeId: 'scope-shell',
        sourceKey: 'shell-history:/tmp/.zsh_history',
        sourceCategory: 'shell',
      }),
    ).resolves.toBe(false);
  });
});
