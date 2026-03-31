# Use Fastify For The Local HTTP Surface

## Status

Accepted on 2026-03-31.

## Context

MirrorBrain already had a local HTTP API, but it was implemented directly on top of `node:http`.

That approach was enough for a small local MVP, but it had two clear drawbacks:

- no built-in OpenAPI schema or interactive API docs
- route contracts and request validation remained mostly implicit

The product direction still requires a TypeScript backend, so switching the HTTP surface to Python `FastAPI` would conflict with the repository constraints.

## Decision

MirrorBrain keeps its TypeScript backend and moves the HTTP surface to:

- `fastify`
- `@fastify/swagger`
- `@fastify/swagger-ui`

This gives the project a FastAPI-like operator experience:

- structured route declarations
- OpenAPI schema generation
- interactive docs at `/docs`
- machine-readable schema at `/openapi.json`

The domain and service layers stay unchanged. Only the HTTP surface is replaced.

## Consequences

Positive:

- local operators can inspect and call the API through Swagger UI
- route inputs and outputs become more explicit
- the HTTP layer is easier to evolve without continuing a hand-rolled server path

Trade-offs:

- the server component now depends on Fastify plugins
- route schemas must be maintained alongside the TypeScript service contract

## Follow-Up

- keep README and component docs pointing to `/docs`
- tighten request and response schemas as APIs become richer
- consider generating shared API client types later if the HTTP surface grows beyond the MVP
