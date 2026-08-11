# Domain Docs

How engineering skills consume this repository's domain documentation.

## Before exploring

Read the root `CONTEXT.md` and any relevant ADRs under `docs/adr/`.

If these files do not exist, proceed silently. The domain-modeling workflows create them lazily when terminology or architectural decisions are resolved.

## Layout

This repository uses a single-context layout:

```
/
|-- CONTEXT.md
`-- docs/adr/
```

## Vocabulary

Use domain terms as defined in `CONTEXT.md`. Avoid synonyms that the glossary explicitly rejects.

If a required concept is missing, reconsider whether it belongs to the project or record the gap for domain modeling.

## ADR conflicts

Explicitly surface output that contradicts an existing ADR rather than silently overriding the decision.
