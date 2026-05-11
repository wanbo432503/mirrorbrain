import type {
  AuthorizationScope,
  MirrorBrainSourceCategory,
} from '../../shared/types/index.js';

interface CreateAuthorizationScopeInput {
  id: string;
  sourceCategory: MirrorBrainSourceCategory;
}

interface CreateMemorySourceAuthorizationPolicyInput {
  getAuthorizationScope(scopeId: string): Promise<AuthorizationScope | null>;
}

interface MemorySourceAuthorizationPolicyInput {
  scopeId: string;
  sourceKey: string;
  sourceCategory: MirrorBrainSourceCategory;
}

export function createAuthorizationScope(
  input: CreateAuthorizationScopeInput,
): AuthorizationScope {
  return {
    id: input.id,
    sourceCategory: input.sourceCategory,
    revokedAt: null,
  };
}

export function isSourceCategoryAuthorized(
  scope: AuthorizationScope,
  sourceCategory: MirrorBrainSourceCategory,
): boolean {
  if (scope.revokedAt !== null) {
    return false;
  }

  return scope.sourceCategory === sourceCategory;
}

export function revokeAuthorizationScope(
  scope: AuthorizationScope,
): AuthorizationScope {
  return {
    ...scope,
    revokedAt: new Date().toISOString(),
  };
}

export function createMemorySourceAuthorizationPolicy(
  input: CreateMemorySourceAuthorizationPolicyInput,
): (source: MemorySourceAuthorizationPolicyInput) => Promise<boolean> {
  return async (source) => {
    const scope = await input.getAuthorizationScope(source.scopeId);

    if (scope === null) {
      return false;
    }

    return isSourceCategoryAuthorized(scope, source.sourceCategory);
  };
}
