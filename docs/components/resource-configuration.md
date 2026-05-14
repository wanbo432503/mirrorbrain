# Resource Configuration

## Summary

Resource Configuration stores provider settings for MirrorBrain runtime
resources that support knowledge and retrieval workflows: an OpenAI-compatible
LLM resource, an OpenAI-compatible embedding resource, and Tavily search.

The component is an operational configuration surface. It does not capture
memory, synthesize knowledge, or execute skills by itself.

## Responsibility Boundary

This component is responsible for:

- persisting provider resource settings to the project `.env` file
- exposing `GET /resources/config` and `PATCH /resources/config`
- redacting provider API keys from every read response
- preserving existing API keys when a PATCH omits a replacement key
- giving the standalone React UI a top-level `configure` tab after `skill`
- presenting the resource variable names from `.env.example` directly beside
  the editable controls

This component is not responsible for:

- deciding which workflows may use a configured resource
- weakening memory-source authorization scopes
- silently promoting memory into knowledge or skills
- executing Tavily searches or LLM calls from the configuration UI
- owning non-resource runtime configuration such as workspace path,
  ActivityWatch, host, port, or sync interval values

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
3. The service reads the project `.env` file or returns empty resource defaults.
4. The API response includes `apiKeyConfigured` booleans but never raw API keys.
5. The user updates one resource card and clicks save.
6. The UI sends a resource-scoped `PATCH /resources/config` request.
7. The service merges that update with existing `.env` content. Blank or
   omitted API keys leave the previously stored key intact.
8. The updated `.env` file is persisted and the resource configuration is
   returned in redacted form.

## Data Structures

The stored form maps directly to resource variables in `.env`:

```text
MIRRORBRAIN_LLM_API_BASE=
MIRRORBRAIN_LLM_API_KEY=
MIRRORBRAIN_LLM_MODEL=
MIRRORBRAIN_EMBEDDING_API_BASE=
MIRRORBRAIN_EMBEDDING_API_KEY=
MIRRORBRAIN_EMBEDDING_MODEL=
MIRRORBRAIN_TAVILY_API_BASE=
MIRRORBRAIN_TAVILY_API_KEY=
MIRRORBRAIN_TAVILY_MAX_RESULTS=
```

The public API form replaces each secret with:

```ts
apiKeyConfigured: boolean
```

## Failure Modes And Operational Constraints

- Missing `.env` files resolve to empty disabled resource defaults.
- Existing unrelated `.env` entries, comments, and non-resource runtime values
  are preserved when resource variables are updated.
- API keys are local secrets and are not returned to agent clients or the web
  UI after save.
- This component only stores resource settings. The current LLM caller already
  reads `MIRRORBRAIN_LLM_*` environment variables; embedding and Tavily values
  are reserved for future runtime consumers.
- Search configuration is currently Tavily-specific because Tavily is the
  planned first search provider.
- Non-resource variables from `.env.example` are shown in the configure tab as
  reference names, but this component does not edit them.

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
