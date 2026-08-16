# AI Agent Instructions

## Vault Structure

- `raw/` is immutable and read-only.
- Do not edit, move, rename, delete, summarize into, or otherwise modify files in `raw/`.
- Treat files in `raw/` as source material only.

## Update Rules

- All updates, notes, summaries, indexes, synthesized pages, and derived work must be created or modified in `wiki/`.
- Do not write generated or edited content back into `raw/`.
- Use `templates/` when creating new standard documents.

## Citation Rules

- Every claim must cite the source file it came from.
- Citations must identify the relevant file path in `raw/`.
- If a claim cannot be traced to a source file, label it as uncited or do not include it.

## Contradictions

- Track contradictions in `wiki/contradictions.md`.
