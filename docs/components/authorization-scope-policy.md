# Authorization Scope Policy

## Summary

This component defines the Phase 1 authorization gate for MirrorBrain source categories. It creates explicit authorization scopes, checks whether a source category is currently allowed, and supports revocation for future capture attempts.

## Responsibility Boundary

This component is responsible for:

- creating source-category authorization scopes
- checking whether a source category is currently authorized
- revoking a scope so future capture attempts are denied

This component is not responsible for:

- capturing source events
- persisting authorization scopes durably
- deciding retention or deletion behavior for previously captured data

## Key Interfaces

- `createAuthorizationScope(...)`
- `isSourceCategoryAuthorized(...)`
- `revokeAuthorizationScope(...)`

## Data Flow

1. A caller creates an authorization scope for a supported MirrorBrain source category.
2. Capture or ingestion logic checks that scope before accepting source events.
3. If the user revokes the scope, subsequent authorization checks fail.

## Test Strategy

- unit coverage in `src/modules/authorization-scope-policy/index.test.ts`
- broader policy enforcement coverage through integration and workflow tests that depend on source authorization

## Known Risks Or Limitations

- scopes are currently in-memory values rather than a durable authorization registry
- revocation currently blocks future capture checks but does not itself enforce retrospective data cleanup
