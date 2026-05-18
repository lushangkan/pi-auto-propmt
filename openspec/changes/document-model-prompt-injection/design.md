## Context

Pi extensions can subscribe to lifecycle events and register slash commands. The model prompt extension will use Pi's `before_agent_start` lifecycle hook to prepend resolved prompt snippets to the effective system prompt for each agent run, and a registered command to inspect or switch the active prompt variant.

The feature is driven by plain Markdown files in a prompt directory. Users author files such as `all.md`, `gpt-5.5.md`, and `gpt-5.5@strict.md`; the extension resolves the current model to one model prompt family and injects at most one selected variant in addition to `all.md`.

## Goals / Non-Goals

**Goals:**

- Preserve Pi's existing system prompt by prepending model prompt content to `event.systemPrompt` rather than rebuilding or replacing it.
- Provide deterministic prompt file discovery, fuzzy model matching, version selection, and injection ordering.
- Provide a small command surface for viewing current resolution and switching the current model family's prompt variant.
- Keep the implementation testable through isolated filename parsing, resolution, and assembly functions.

**Non-Goals:**

- Do not modify provider payloads directly in the first implementation.
- Do not replace Pi prompt templates or slash-prompt expansion.
- Do not implement prompt file CRUD commands; users edit Markdown files directly.
- Do not guarantee absolute final ordering relative to extensions that run after this extension in Pi's hook order.
- Do not change the active LLM model; the command only changes prompt variant selection.

## Decisions

### Use `before_agent_start` for injection

The extension will return a rewritten `systemPrompt` from `before_agent_start`:

```text
<resolved all.md content>

<resolved selected model prompt content>

<event.systemPrompt>
```

This satisfies the requirement to add content at the top of the system prompt without replacing Pi's existing prompt. Returning a separate message is rejected because it would create a context message rather than a system prompt prefix. Rewriting provider payloads in `before_provider_request` is rejected for v1 because it is provider-specific and harder to inspect through Pi's system-prompt APIs.

### Treat prompt files as extension-owned configuration

The extension will scan a documented `prompts/` directory rather than relying on Pi prompt-template discovery. Prompt templates are invoked by slash commands; this feature requires automatic system prompt injection.

For v1, the primary prompt directory is project-local:

```text
.pi/model-prompts/prompts/
```

This keeps project behavior reproducible and avoids immediate global/project merge conflicts. A later change can add a user-global directory with explicit precedence.

### Parse filenames into a single source-of-truth model

Discovery will only consider Markdown files directly under the prompt directory. Basenames are parsed as:

- `all.md`: global prompt, reserved.
- `<model-key>.md`: default prompt variant for a model family.
- `<model-key>@<version>.md`: named prompt variant for a model family.

The parser will preserve the on-disk filename for diagnostics but use normalized keys internally. Invalid or unsupported names are ignored with a debug/status warning rather than causing prompt injection to fail.

### Match model families deterministically

The resolver will compare prompt model keys against both available current model identity strings, such as model `id` and display `name` when exposed by Pi. A model family matches when any normalized model identity string contains the normalized prompt model key.

If multiple model keys match, the longest matching key wins. This makes `gpt-5.5-mini` more specific than `gpt-5.5`, and `gpt-5.5` more specific than `gpt`.

Exactly one model-specific prompt variant is injected for a run.

### Version selection is per model family

The extension will store selected versions keyed by normalized model key. If no version is selected for the matched model family, the resolver uses the unversioned file when present. If only versioned files exist, the resolver does not guess; it injects only `all.md` and reports that a version should be selected.

Version switching affects only the currently matched model family. Switching from one model family to another resolves that family's own selected/default variant.

### Provide one command for status and switching

The extension will register one command, tentatively `/model-prompt`, that supports:

- no argument: interactive/status flow for the current model family;
- `status`: show current model identities, matched family, selected version, injected files, and prompt directory;
- `use <version>`: select a named version for the current model family;
- `reset`: clear the selected version and return to the unversioned default when available.

The command must fail softly when no prompt directory, no matching model family, or no requested version exists.

## Risks / Trade-offs

- [Risk] Other extensions may run after this extension and further modify the system prompt. → Mitigation: document that this extension prepends to the prompt it receives in hook order; users can control extension load order when strict ordering matters.
- [Risk] Fuzzy substring matching can produce surprising matches. → Mitigation: longest-match precedence, status diagnostics, and tests for overlapping names.
- [Risk] Prompt file edits may not be obvious at runtime. → Mitigation: resolve from disk on each `before_agent_start` or provide a clear reload/cache invalidation rule; prefer reading on each run for v1 simplicity.
- [Risk] Missing or malformed files could break conversations. → Mitigation: ignore invalid files, skip empty content, and never fail the agent start solely because prompts are unavailable.
- [Risk] State persistence can become ambiguous across sessions. → Mitigation: keep v1 state project-local and keyed by normalized model family; document the file format.

## Migration Plan

This is a new extension capability, so no existing users need migration. Implementation can be rolled out by adding the extension file, creating `.pi/model-prompts/prompts/`, and optionally adding sample prompt files. Rollback is removing or disabling the extension; prompt files are inert without it.

## Open Questions

- Should v1 store selected versions in a JSON file under `.pi/model-prompts/state.json`, or use Pi session entries for branch-aware persistence?
- Should command name be `/model-prompt`, `/mprompt`, or another shorter alias?
- Should matching be case-insensitive by default? The recommended v1 answer is yes for usability, while preserving original filenames in diagnostics.
