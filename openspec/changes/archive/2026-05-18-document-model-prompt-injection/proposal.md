## Why

Pi users often switch between model families that benefit from different operating instructions, but today those model-specific prompts must be copied manually or baked into broad system prompts. This change documents a Pi extension that automatically prepends prompt snippets based on the active model while preserving Pi's existing system prompt and other context.

## What Changes

- Add a model-aware prompt injection extension packaged as a standard Pi package with a `pi.extensions` manifest for `pi install`.
- Scan each consuming project's prompt directory for Markdown snippets.
- Inject `all.md` for every model before any model-specific prompt.
- Match model-specific prompt files by fuzzy substring matching against the active model identity after removing `.md` and optional `@version` suffixes.
- Support multiple prompt variants per model using filenames like `gpt-5.5@strict.md`.
- Add a slash command for inspecting and switching the active prompt variant for the current model family.
- Preserve Pi's existing system prompt by prepending injected content rather than replacing it.

## Capabilities

### New Capabilities

- `model-prompt-injection`: Defines model-aware prompt discovery, matching, version selection, injection order, state persistence, and user command behavior.

### Modified Capabilities

- None.

## Impact

- Adds an npm/GitHub-distributable Pi package containing the model prompt extension.
- Affects Pi extension code, prompt file conventions, command registration, package metadata, and validation tests.
- No provider API changes are required; the extension should use Pi lifecycle hooks and command APIs.
