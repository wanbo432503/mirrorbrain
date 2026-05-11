# Authorization Scope Policy

## Summary

This component defines the Phase 1 authorization gate for MirrorBrain source categories. It creates explicit authorization scopes, checks whether a source category is currently allowed, and supports revocation for future capture attempts.

## Responsibility Boundary

This component is responsible for:

- creating source-category authorization scopes
- checking whether a source category is currently authorized
- revoking a scope so future capture attempts are denied
- creating a runtime memory-source authorization policy from a scope lookup function

This component is not responsible for:

- capturing source events
- persisting authorization scopes durably
- deciding retention or deletion behavior for previously captured data

## Key Interfaces

- `createAuthorizationScope(...)`
- `isSourceCategoryAuthorized(...)`
- `revokeAuthorizationScope(...)`
- `createMemorySourceAuthorizationPolicy(...)`

## Data Flow

1. A caller creates an authorization scope for a supported MirrorBrain source category.
2. Capture or ingestion logic checks that scope before accepting source events.
3. If the user revokes the scope, subsequent authorization checks fail.

For runtime source sync, `createMemorySourceAuthorizationPolicy(...)` accepts a `getAuthorizationScope(scopeId)` dependency and returns a policy function that receives `scopeId`, `sourceKey`, and `sourceCategory`. The current implementation allows sync only when the scope exists, is not revoked, and matches the requested source category. `sourceKey` is part of the policy input so later source-instance rules can support paths, buckets, or domains without changing the sync workflow contract again.

## Test Strategy

- unit coverage in `src/modules/authorization-scope-policy/index.test.ts`
- broader policy enforcement coverage through integration and workflow tests that depend on source authorization

## Known Risks Or Limitations

- scopes are currently supplied by an injected lookup rather than a durable authorization registry owned by this module
- revocation currently blocks future capture checks but does not itself enforce retrospective data cleanup
- the current runtime policy is category-level; source-instance allowlists remain future work
