# Resource Configuration

## Summary

Resource Configuration stores provider settings for MirrorBrain runtime
resources that support knowledge and retrieval workflows: an OpenAI-compatible
LLM resource, an OpenAI-compatible embedding resource, and Tavily search.

The component is an operational configuration surface. It does not capture
memory, synthesize knowledge, or execute skills by itself.

## Responsibility Boundary

This component is responsible for:

- persisting provider resource settings under MirrorBrain workspace state
- exposing `GET /resources/config` and `PATCH /resources/config`
- redacting provider API keys from every read response
- preserving existing API keys when a PATCH omits a replacement key
- giving the standalone React UI a top-level `configure` tab after `skill`

This component is not responsible for:

- deciding which workflows may use a configured resource
- weakening memory-source authorization scopes
- silently promoting memory into knowledge or skills
- executing Tavily searches or LLM calls from the configuration UI
- replacing existing environment-based runtime configuration until a migration
  plan explicitly does so

## Key Interfaces

Backend:

- `ResourceConfiguration`
- `ResourceConfigurationUpdate`
- `createFileResourceConfigurationStore`
- `MirrorBrainService.getResourceConfiguration`
- `MirrorBrainService.updateResourceConfiguration`

HTTP API:

- `GET /resources/config`
- `PATCH /resources/config`

Frontend:

- `ConfigurePanel`
- `MirrorBrainWebAppApi.getResourceConfiguration`
- `MirrorBrainWebAppApi.updateResourceConfiguration`

## Data Flow

1. The user opens the `configure` tab.
2. The React app calls `GET /resources/config`.
3. The service reads `<workspaceDir>/mirrorbrain/state/resource-configuration.json`
   or returns disabled defaults.
4. The API response includes `apiKeyConfigured` booleans but never raw API keys.
5. The user updates one resource card and clicks save.
6. The UI sends a resource-scoped `PATCH /resources/config` request.
7. The service merges that update with existing stored configuration. Blank or
   omitted API keys leave the previously stored key intact.
8. The updated configuration is persisted and returned in redacted form.

## Data Structures

The stored form keeps secrets inside the local MirrorBrain workspace state file:

```ts
interface StoredResourceConfiguration {
  llm: StoredOpenAICompatibleResourceConfig
  embedding: StoredOpenAICompatibleResourceConfig
  search: StoredTavilySearchResourceConfig
}
```

The public API form replaces each secret with:

```ts
apiKeyConfigured: boolean
```

## Failure Modes And Operational Constraints

- Missing configuration files resolve to disabled defaults.
- Invalid or unreadable JSON fails the request rather than silently replacing
  configuration.
- API keys are local secrets and are not returned to agent clients or the web
  UI after save.
- This component only stores resource settings. Runtime consumers still need
  explicit integration work before they should read these settings.
- Search configuration is currently Tavily-specific because Tavily is the
  planned first search provider.

## Test Strategy

Run the focused checks from the repository root:

```bash
pnpm vitest run \
  src/modules/resource-configuration/index.test.ts \
  src/integrations/resource-configuration-store/index.test.ts \
  src/apps/mirrorbrain-service/index.test.ts \
  src/apps/mirrorbrain-http-server/index.test.ts
```

Run React checks from `src/apps/mirrorbrain-web-react`:

```bash
corepack pnpm vitest run \
  src/api/client.test.ts \
  src/components/configure/ConfigurePanel.test.tsx \
  src/App.test.tsx
```
